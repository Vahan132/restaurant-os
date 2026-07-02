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
} from '../../helpers/reservations';
import { readFixtures } from '../../helpers/session';

const DOUBLE_BOOKING_TABLE = {
   name: 'E2E Reservation Double Booking',
   qrIdentifier: 'e2e-reservation-double-booking',
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

function futureReservationWindow(): {
   reservedAt: string;
   windowStart: string;
   windowEnd: string;
} {
   const start = new Date();
   start.setUTCDate(start.getUTCDate() + 61);
   start.setUTCHours(20, 0, 0, 0);

   const end = new Date(start.getTime() + RESERVATION_DURATION_MINUTES * 60_000);

   return {
      reservedAt: start.toISOString(),
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
   };
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

function errorCode(text: string): string | undefined {
   const body = parseJsonBody<ApiErrorBody>(
      text,
      'POST /reservations overlapping double-booking response',
   );

   return body.error?.code ?? body.code;
}

async function ensureDoubleBookingTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
): Promise<TableResponse> {
   const existing = (await listTables(request, auth)).find(
      (table) =>
         table.qrIdentifier === DOUBLE_BOOKING_TABLE.qrIdentifier ||
         table.name === DOUBLE_BOOKING_TABLE.name,
   );

   if (existing) return existing;

   const floors = await listFloors(request, auth);
   const floor = floors.find((candidate) => candidate.status === 'ACTIVE') ?? floors[0];

   if (!floor) {
      throw new Error('Cannot create reservation double-booking E2E table: GET /floors returned no floors.');
   }

   return createTable(request, auth, {
      floorId: floor.id,
      name: DOUBLE_BOOKING_TABLE.name,
      seatCapacity: 4,
      qrIdentifier: DOUBLE_BOOKING_TABLE.qrIdentifier,
   });
}

async function resetDoubleBookingTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   table: TableResponse,
): Promise<TableResponse> {
   await cancelActiveReservationsForTable(
      request,
      auth,
      table.id,
      'E2E reservation double-booking setup cleanup',
   );

   const activeOrders = await listActiveOrdersForTable(request, auth, table.id);
   for (const order of activeOrders) {
      await cancelOrder(request, auth, order.id, 'E2E reservation double-booking order cleanup');
   }

   const remainingOrders = await listActiveOrdersForTable(request, auth, table.id);
   expect(
      remainingOrders,
      [
         'Reservation double-booking setup could not clear active orders.',
         `table id/name: ${table.id} / ${table.name}`,
         `remaining order ids/statuses: ${remainingOrders.map((order) => `${order.id}:${order.status ?? '<unknown>'}`).join(', ') ||
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

function parseReservationIfCreated(text: string): ReservationResponse | null {
   try {
      const body = parseJsonBody<ReservationResponse>(text, 'unexpected successful second reservation');
      return typeof body?.id === 'string' ? body : null;
   } catch {
      return null;
   }
}

test.describe('reservation double-booking conflict', () => {
   test('rejects a second overlapping reservation for the same table and time window', async ({
      request,
   }) => {
      const fixture = readFixtures() as CustomerOrderRequestFixture;

      await expectApiHealth(request, { label: 'primary API for reservation double-booking' });

      const auth = await seededOwnerAuthHeaders(request, fixture);
      const table = await resetDoubleBookingTable(
         request,
         auth,
         await ensureDoubleBookingTable(request, auth),
      );

      expect(table.status, `Double-booking table ${table.id} must start AVAILABLE.`).toBe('AVAILABLE');

      const window = futureReservationWindow();

      const availabilityBefore = await getAvailabilityForTable(request, auth, table.id, window);
      expect(availabilityBefore.status, `Table ${table.id} should start AVAILABLE.`).toBe('AVAILABLE');
      expect(
         availabilityBefore.reservations,
         `Table ${table.id} should not have overlapping active reservations before test.`,
      ).toHaveLength(0);

      let firstReservationId: string | undefined;
      let secondReservationId: string | undefined;

      try {
         const firstCreated = await createReservation(request, auth, {
            customerName: 'E2E Double Booking Guest One',
            customerPhone: '+374 99 000006',
            guestCount: 2,
            reservedAt: window.reservedAt,
            durationMinutes: RESERVATION_DURATION_MINUTES,
            tableId: table.id,
            notes: 'First reservation created by double-booking E2E',
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

         const availabilityAfterFirst = await getAvailabilityForTable(request, auth, table.id, window);
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

         const secondAttempt = await requestText(request, 'post', `${ENV.apiBaseUrl}/reservations`, {
            headers: auth,
            data: {
               customerName: 'E2E Double Booking Guest Two',
               customerPhone: '+374 99 000007',
               guestCount: 2,
               reservedAt: window.reservedAt,
               durationMinutes: RESERVATION_DURATION_MINUTES,
               tableId: table.id,
               notes: 'Second overlapping reservation created by double-booking E2E',
            },
         });

         if (secondAttempt.ok) {
            secondReservationId = parseReservationIfCreated(secondAttempt.text)?.id;
         }

         expect(
            secondAttempt.ok,
            [
               'Second overlapping reservation should be rejected.',
               `status: ${secondAttempt.status}`,
               `body: ${secondAttempt.text}`,
               `table id/name: ${table.id} / ${table.name}`,
               `first reservation id: ${firstCreated.id}`,
               `reservedAt: ${window.reservedAt}`,
               `durationMinutes: ${RESERVATION_DURATION_MINUTES}`,
            ].join('\n'),
         ).toBeFalsy();

         expect(
            [400, 409],
            `Double-booking should return a client/conflict error: ${secondAttempt.status} ${secondAttempt.text}`,
         ).toContain(secondAttempt.status);

         expect(
            errorCode(secondAttempt.text),
            `Double-booking rejection should expose a stable error code. Body: ${secondAttempt.text}`,
         ).toBeTruthy();

         const firstAfterRejectedSecond = await getReservation(request, auth, firstCreated.id);
         expect(
            firstAfterRejectedSecond.status,
            `Rejected double-booking must not change first reservation ${firstCreated.id}.`,
         ).toBe('CONFIRMED');
         expect(
            firstAfterRejectedSecond.tableId,
            `Rejected double-booking must keep first reservation ${firstCreated.id} on its table.`,
         ).toBe(table.id);

         const tableAfterRejectedSecond = await reloadTable(request, auth, table.id);
         expect(
            tableAfterRejectedSecond.status,
            `Future confirmed reservation should not change live table status ${table.id}.`,
         ).toBe('AVAILABLE');

         const availabilityAfterRejectedSecond = await getAvailabilityForTable(request, auth, table.id, window);
         expect(
            availabilityAfterRejectedSecond.reservations.map((reservation) => reservation.reservationId),
            `Availability should still include first reservation ${firstCreated.id}.`,
         ).toContain(firstCreated.id);

         if (secondReservationId) {
            expect(
               availabilityAfterRejectedSecond.reservations.map((reservation) => reservation.reservationId),
               `Availability should not include rejected/bug-created second reservation ${secondReservationId}.`,
            ).not.toContain(secondReservationId);
         }

         expect(
            availabilityAfterRejectedSecond.reservations.filter((reservation) =>
               ['PENDING', 'CONFIRMED', 'ARRIVED', 'SEATED'].includes(reservation.status),
            ),
            'Only one active reservation should block the table/time window.',
         ).toHaveLength(1);
      } finally {
         if (secondReservationId) {
            const reservation = await getReservation(request, auth, secondReservationId).catch(() => null);
            if (reservation && ACTIVE_RESERVATION_STATUSES.has(reservation.status)) {
               await cancelReservation(
                  request,
                  auth,
                  reservation.id,
                  'E2E reservation double-booking cleanup for unexpected second reservation',
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
                  'E2E reservation double-booking cleanup',
               ).catch(() => undefined);
            }
         }

         await resetDoubleBookingTable(request, auth, table).catch(() => undefined);
      }
   });
});