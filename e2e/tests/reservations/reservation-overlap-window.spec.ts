import { test, expect, type APIRequestContext } from '@playwright/test';
import { ENV } from '../../config/env';
import { expectApiHealth } from '../../helpers/health';
import {
   cancelOrder,
   changeTableStatus,
   createTable,
   listActiveOrdersForTable,
   listFloors,
   listTables,
   parseJsonBody,
   responseBodyText,
   seededOwnerAuthHeaders,
   type CustomerOrderRequestFixture,
   type PosAuthHeaders,
   type TableResponse,
} from '../../helpers/order-requests';
import {
   ACTIVE_RESERVATION_STATUSES,
   cancelActiveReservationsForTable,
   cancelReservation,
   confirmReservation,
   createReservation,
   getAvailabilityForTable,
   getReservation,
   reloadTable,
   type ReservationResponse,
   type TableAvailabilityResponse,
} from '../../helpers/reservations';
import { readFixtures } from '../../helpers/session';

const OVERLAP_WINDOW_TABLE = {
   name: 'E2E Reservation Overlap Window',
   qrIdentifier: 'e2e-reservation-overlap-window',
} as const;

const RESERVATION_DURATION_MINUTES = 90;

interface RequestResult {
   status: number;
   ok: boolean;
   text: string;
}

interface ApiErrorBody {
   error?: {
      code?: string;
      message?: string;
   };
   code?: string;
   message?: string;
}

interface ReservationWindow {
   reservedAt: string;
   windowStart: string;
   windowEnd: string;
}

function reservationWindows(): {
   first: ReservationWindow;
   startsInside: ReservationWindow;
   startsBefore: ReservationWindow;
} {
   const firstStart = new Date();
   firstStart.setUTCDate(firstStart.getUTCDate() + 67);
   firstStart.setUTCHours(20, 0, 0, 0);

   const firstEnd = new Date(firstStart.getTime() + RESERVATION_DURATION_MINUTES * 60_000);
   const startsInsideStart = new Date(firstStart.getTime() + 30 * 60_000);
   const startsInsideEnd = new Date(
      startsInsideStart.getTime() + RESERVATION_DURATION_MINUTES * 60_000,
   );
   const startsBeforeStart = new Date(firstStart.getTime() - 30 * 60_000);
   const startsBeforeEnd = new Date(
      startsBeforeStart.getTime() + RESERVATION_DURATION_MINUTES * 60_000,
   );

   return {
      first: {
         reservedAt: firstStart.toISOString(),
         windowStart: firstStart.toISOString(),
         windowEnd: firstEnd.toISOString(),
      },
      startsInside: {
         reservedAt: startsInsideStart.toISOString(),
         windowStart: startsInsideStart.toISOString(),
         windowEnd: startsInsideEnd.toISOString(),
      },
      startsBefore: {
         reservedAt: startsBeforeStart.toISOString(),
         windowStart: startsBeforeStart.toISOString(),
         windowEnd: startsBeforeEnd.toISOString(),
      },
   };
}

function activeReservationIds(availability: TableAvailabilityResponse): string[] {
   return availability.reservations
      .filter((reservation) => ACTIVE_RESERVATION_STATUSES.has(reservation.status))
      .map((reservation) => reservation.reservationId);
}

function errorCode(text: string, context: string): string | undefined {
   const body = parseJsonBody<ApiErrorBody>(text, context);
   return body.error?.code ?? body.code;
}

function parseReservationIfCreated(text: string): ReservationResponse | null {
   try {
      const body = parseJsonBody<ReservationResponse>(
         text,
         'unexpected successful overlapping reservation',
      );
      return typeof body?.id === 'string' ? body : null;
   } catch {
      return null;
   }
}

async function requestText(
   request: APIRequestContext,
   method: 'post',
   url: string,
   options: { headers?: Record<string, string>; data?: unknown } = {},
): Promise<RequestResult> {
   const response = await request[method](url, {
      headers: options.headers,
      data: options.data,
      failOnStatusCode: false,
      ignoreHTTPSErrors: true,
   });

   return {
      status: response.status(),
      ok: response.ok(),
      text: await responseBodyText(response),
   };
}

async function ensureOverlapWindowTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
): Promise<TableResponse> {
   const existing = (await listTables(request, auth)).find(
      (table) =>
         table.qrIdentifier === OVERLAP_WINDOW_TABLE.qrIdentifier ||
         table.name === OVERLAP_WINDOW_TABLE.name,
   );

   if (existing) return existing;

   const floors = await listFloors(request, auth);
   const floor = floors.find((candidate) => candidate.status === 'ACTIVE') ?? floors[0];

   if (!floor) {
      throw new Error('Cannot create reservation overlap-window E2E table: GET /floors returned no floors.');
   }

   return createTable(request, auth, {
      floorId: floor.id,
      name: OVERLAP_WINDOW_TABLE.name,
      seatCapacity: 4,
      qrIdentifier: OVERLAP_WINDOW_TABLE.qrIdentifier,
   });
}

async function resetOverlapWindowTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   table: TableResponse,
): Promise<TableResponse> {
   await cancelActiveReservationsForTable(
      request,
      auth,
      table.id,
      'E2E reservation overlap-window setup cleanup',
   );

   const activeOrders = await listActiveOrdersForTable(request, auth, table.id);
   for (const order of activeOrders) {
      await cancelOrder(request, auth, order.id, 'E2E reservation overlap-window order cleanup');
   }

   const remainingOrders = await listActiveOrdersForTable(request, auth, table.id);
   expect(
      remainingOrders,
      [
         'Reservation overlap-window setup could not clear active orders.',
         `table id/name: ${table.id} / ${table.name}`,
         `remaining order ids/statuses: ${
            remainingOrders.map((order) => `${order.id}:${order.status ?? '<unknown>'}`).join(', ') ||
            '<none>'
         }`,
      ].join('\n'),
   ).toHaveLength(0);

   const current = await reloadTable(request, auth, table.id);

   if (current.status === 'AVAILABLE') return current;

   if (current.status === 'CLEANING' || current.status === 'DISABLED') {
      return changeTableStatus(request, auth, table.id, 'AVAILABLE');
   }

   throw new Error(
      [
         `Table ${table.id} / ${table.name} could not be reset to AVAILABLE.`,
         `Current status: ${current.status}`,
         'Expected reservation/order cleanup to release it.',
      ].join('\n'),
   );
}

async function attemptOverlappingReservation(input: {
   request: APIRequestContext;
   auth: PosAuthHeaders;
   table: TableResponse;
   window: ReservationWindow;
   customerName: string;
   customerPhone: string;
   label: string;
}): Promise<{ createdId?: string }> {
   const attempt = await requestText(input.request, 'post', `${ENV.apiBaseUrl}/reservations`, {
      headers: input.auth,
      data: {
         customerName: input.customerName,
         customerPhone: input.customerPhone,
         guestCount: 2,
         reservedAt: input.window.reservedAt,
         durationMinutes: RESERVATION_DURATION_MINUTES,
         tableId: input.table.id,
         notes: `Overlapping ${input.label} reservation created by reservation overlap-window E2E`,
      },
   });

   const created = attempt.ok ? parseReservationIfCreated(attempt.text) : null;

   expect.soft(
      attempt.ok,
      [
         `${input.label} overlapping reservation should be rejected.`,
         `status: ${attempt.status}`,
         `body: ${attempt.text}`,
         `table id/name: ${input.table.id} / ${input.table.name}`,
         `reservedAt: ${input.window.reservedAt}`,
         `durationMinutes: ${RESERVATION_DURATION_MINUTES}`,
      ].join('\n'),
   ).toBeFalsy();

   if (attempt.ok) {
      return { createdId: created?.id };
   }

   expect.soft(
      [400, 409],
      `${input.label} overlap should return client/conflict error: ${attempt.status} ${attempt.text}`,
   ).toContain(attempt.status);

   expect.soft(
      errorCode(attempt.text, `POST /reservations ${input.label} overlap response`),
      `${input.label} overlap rejection should expose a stable error code. Body: ${attempt.text}`,
   ).toBeTruthy();

   return {};
}

test.describe('reservation overlapping window conflict', () => {
   test('rejects overlapping reservations with different start times on the same table', async ({
      request,
   }) => {
      const fixture = readFixtures() as CustomerOrderRequestFixture;

      await expectApiHealth(request, { label: 'primary API for reservation overlap-window' });

      const auth = await seededOwnerAuthHeaders(request, fixture);
      const table = await resetOverlapWindowTable(
         request,
         auth,
         await ensureOverlapWindowTable(request, auth),
      );

      expect(table.status, `Overlap-window table ${table.id} must start AVAILABLE.`).toBe('AVAILABLE');

      const windows = reservationWindows();

      const availabilityBefore = await getAvailabilityForTable(request, auth, table.id, windows.first);
      expect(availabilityBefore.status, `Table ${table.id} should start AVAILABLE.`).toBe('AVAILABLE');
      expect(
         availabilityBefore.reservations,
         `Table ${table.id} should not have overlapping active reservations before test.`,
      ).toHaveLength(0);

      let firstReservationId: string | undefined;
      const unexpectedReservationIds: string[] = [];

      try {
         const firstCreated = await createReservation(request, auth, {
            customerName: 'E2E Overlap Window Guest One',
            customerPhone: '+374 99 000011',
            guestCount: 2,
            reservedAt: windows.first.reservedAt,
            durationMinutes: RESERVATION_DURATION_MINUTES,
            tableId: table.id,
            notes: 'First reservation created by overlap-window E2E',
         });
         firstReservationId = firstCreated.id;

         expect(firstCreated.status, `First reservation ${firstCreated.id} should start PENDING.`).toBe(
            'PENDING',
         );
         expect(firstCreated.tableId, `First reservation ${firstCreated.id} should use E2E table.`).toBe(
            table.id,
         );

         const firstConfirmed = await confirmReservation(request, auth, firstCreated.id);
         expect(firstConfirmed.status, `First reservation ${firstCreated.id} should become CONFIRMED.`).toBe(
            'CONFIRMED',
         );

         const availabilityAfterFirst = await getAvailabilityForTable(
            request,
            auth,
            table.id,
            windows.first,
         );
         expect(
            availabilityAfterFirst.reservations.map((reservation) => reservation.reservationId),
            `Availability should include first reservation ${firstCreated.id}.`,
         ).toContain(firstCreated.id);
         expect(
            availabilityAfterFirst.reservations.find(
               (reservation) => reservation.reservationId === firstCreated.id,
            )?.status,
            `Availability should show first reservation ${firstCreated.id} as CONFIRMED.`,
         ).toBe('CONFIRMED');

         const startsInside = await attemptOverlappingReservation({
            request,
            auth,
            table,
            window: windows.startsInside,
            customerName: 'E2E Overlap Window Guest Two',
            customerPhone: '+374 99 000012',
            label: '20:30-22:00',
         });
         if (startsInside.createdId) unexpectedReservationIds.push(startsInside.createdId);

         const startsBefore = await attemptOverlappingReservation({
            request,
            auth,
            table,
            window: windows.startsBefore,
            customerName: 'E2E Overlap Window Guest Three',
            customerPhone: '+374 99 000013',
            label: '19:30-20:30',
         });
         if (startsBefore.createdId) unexpectedReservationIds.push(startsBefore.createdId);

         const firstAfterOverlapAttempts = await getReservation(request, auth, firstCreated.id);
         expect(
            firstAfterOverlapAttempts.status,
            `Rejected overlap attempts must not change first reservation ${firstCreated.id}.`,
         ).toBe('CONFIRMED');
         expect(
            firstAfterOverlapAttempts.tableId,
            `Rejected overlap attempts must keep first reservation ${firstCreated.id} on its table.`,
         ).toBe(table.id);

         const tableAfterOverlapAttempts = await reloadTable(request, auth, table.id);
         expect(
            tableAfterOverlapAttempts.status,
            `Future confirmed reservation should not change live table status ${table.id}.`,
         ).toBe('AVAILABLE');

         const availabilityAfterOverlapAttempts = await getAvailabilityForTable(
            request,
            auth,
            table.id,
            windows.first,
         );
         expect(
            availabilityAfterOverlapAttempts.reservations.map(
               (reservation) => reservation.reservationId,
            ),
            `Availability should still include first reservation ${firstCreated.id}.`,
         ).toContain(firstCreated.id);
         for (const unexpectedId of unexpectedReservationIds) {
            expect.soft(
               availabilityAfterOverlapAttempts.reservations.map(
                  (reservation) => reservation.reservationId,
               ),
               `Availability should not include rejected/bug-created overlapping reservation ${unexpectedId}.`,
            ).not.toContain(unexpectedId);
         }
         expect.soft(
            activeReservationIds(availabilityAfterOverlapAttempts),
            'Only the first active reservation should block the table/time window.',
         ).toEqual([firstCreated.id]);
      } finally {
         for (const reservationId of unexpectedReservationIds) {
            const reservation = await getReservation(request, auth, reservationId).catch(() => null);
            if (reservation && ACTIVE_RESERVATION_STATUSES.has(reservation.status)) {
               await cancelReservation(
                  request,
                  auth,
                  reservation.id,
                  'E2E reservation overlap-window cleanup for unexpected overlapping reservation',
               ).catch(() => undefined);
            }
         }

         if (firstReservationId) {
            const reservation = await getReservation(request, auth, firstReservationId).catch(() => null);
            if (reservation && ACTIVE_RESERVATION_STATUSES.has(reservation.status)) {
               await cancelReservation(
                  request,
                  auth,
                  reservation.id,
                  'E2E reservation overlap-window cleanup',
               ).catch(() => undefined);
            }
         }

         await resetOverlapWindowTable(request, auth, table).catch(() => undefined);
      }
   });
});
