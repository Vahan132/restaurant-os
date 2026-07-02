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
   markReservationArrived,
   reloadTable,
} from '../../helpers/reservations';
import { readFixtures } from '../../helpers/session';

const INVALID_TRANSITION_TABLE = {
   name: 'E2E Reservation Invalid Transition',
   qrIdentifier: 'e2e-reservation-invalid-transition',
} as const;

const RESERVATION_DURATION_MINUTES = 90;

interface RestaurantSettingsResponse {
   allowManualTableStatus: boolean;
}

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
   start.setUTCDate(start.getUTCDate() + 64);
   start.setUTCHours(18, 45, 0, 0);

   const end = new Date(start.getTime() + RESERVATION_DURATION_MINUTES * 60_000);

   return {
      reservedAt: start.toISOString(),
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
   };
}

async function requestText(
   request: APIRequestContext,
   method: 'get' | 'post' | 'patch',
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
      'POST /reservations/:id/complete invalid transition response',
   );

   return body.error?.code ?? body.code;
}

async function getRestaurantSettings(
   request: APIRequestContext,
   auth: PosAuthHeaders,
): Promise<RestaurantSettingsResponse> {
   const response = await requestText(request, 'get', `${ENV.apiBaseUrl}/restaurant/settings`, {
      headers: auth,
   });

   if (!response.ok) {
      throw new Error(`GET /restaurant/settings failed: ${response.status} ${response.text}`);
   }

   return parseJsonBody<RestaurantSettingsResponse>(response.text, 'GET /restaurant/settings');
}

async function setManualTableStatus(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   allowManualTableStatus: boolean,
): Promise<void> {
   const response = await requestText(request, 'patch', `${ENV.apiBaseUrl}/restaurant/settings`, {
      headers: auth,
      data: { allowManualTableStatus },
   });

   if (!response.ok) {
      throw new Error(
         `PATCH /restaurant/settings allowManualTableStatus=${allowManualTableStatus} failed: ${response.status} ${response.text}`,
      );
   }
}

async function withManualTableStatus<T>(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   run: () => Promise<T>,
): Promise<T> {
   const original = await getRestaurantSettings(request, auth);
   const shouldRestore = !original.allowManualTableStatus;

   if (shouldRestore) {
      await setManualTableStatus(request, auth, true);
   }

   try {
      return await run();
   } finally {
      if (shouldRestore) {
         await setManualTableStatus(request, auth, false).catch(() => undefined);
      }
   }
}

async function ensureInvalidTransitionTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
): Promise<TableResponse> {
   const existing = (await listTables(request, auth)).find(
      (table) =>
         table.qrIdentifier === INVALID_TRANSITION_TABLE.qrIdentifier ||
         table.name === INVALID_TRANSITION_TABLE.name,
   );

   if (existing) return existing;

   const floors = await listFloors(request, auth);
   const floor = floors.find((candidate) => candidate.status === 'ACTIVE') ?? floors[0];

   if (!floor) {
      throw new Error(
         'Cannot create reservation invalid-transition E2E table: GET /floors returned no floors.',
      );
   }

   return createTable(request, auth, {
      floorId: floor.id,
      name: INVALID_TRANSITION_TABLE.name,
      seatCapacity: 4,
      qrIdentifier: INVALID_TRANSITION_TABLE.qrIdentifier,
   });
}

async function resetInvalidTransitionTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   table: TableResponse,
): Promise<TableResponse> {
   await cancelActiveReservationsForTable(
      request,
      auth,
      table.id,
      'E2E reservation invalid-transition setup cleanup',
   );

   const activeOrders = await listActiveOrdersForTable(request, auth, table.id);
   for (const order of activeOrders) {
      await cancelOrder(request, auth, order.id, 'E2E reservation invalid-transition order cleanup');
   }

   const remainingOrders = await listActiveOrdersForTable(request, auth, table.id);
   expect(
      remainingOrders,
      [
         'Reservation invalid-transition setup could not clear active orders.',
         `table id/name: ${table.id} / ${table.name}`,
         `remaining order ids/statuses: ${remainingOrders.map((order) => `${order.id}:${order.status ?? '<unknown>'}`).join(', ') ||
         '<none>'
         }`,
      ].join('\n'),
   ).toHaveLength(0);

   const current = await reloadTable(request, auth, table.id);

   if (current.status === 'AVAILABLE') return current;

   return withManualTableStatus(request, auth, async () =>
      changeTableStatus(request, auth, table.id, 'AVAILABLE'),
   );
}

test.describe('reservation invalid transition', () => {
   test('rejects completing an ARRIVED reservation before it is seated', async ({ request }) => {
      const fixture = readFixtures() as CustomerOrderRequestFixture;

      await expectApiHealth(request, { label: 'primary API for reservation invalid transition' });

      const auth = await seededOwnerAuthHeaders(request, fixture);
      const table = await resetInvalidTransitionTable(
         request,
         auth,
         await ensureInvalidTransitionTable(request, auth),
      );

      expect(table.status, `Invalid-transition table ${table.id} must start AVAILABLE.`).toBe(
         'AVAILABLE',
      );

      const window = futureReservationWindow();

      const availabilityBefore = await getAvailabilityForTable(request, auth, table.id, window);
      expect(availabilityBefore.status, `Table ${table.id} should start AVAILABLE.`).toBe('AVAILABLE');
      expect(
         availabilityBefore.reservations,
         `Table ${table.id} should not have overlapping active reservations before test.`,
      ).toHaveLength(0);

      let reservationId: string | undefined;

      try {
         const created = await createReservation(request, auth, {
            customerName: 'E2E Invalid Transition Guest',
            customerPhone: '+374 99 000008',
            guestCount: 2,
            reservedAt: window.reservedAt,
            durationMinutes: RESERVATION_DURATION_MINUTES,
            tableId: table.id,
            notes: 'Created by reservation invalid-transition E2E',
         });

         reservationId = created.id;

         expect(created.status, `Reservation ${created.id} should start PENDING.`).toBe('PENDING');
         expect(created.tableId, `Reservation ${created.id} should use E2E table.`).toBe(table.id);

         const confirmed = await confirmReservation(request, auth, created.id);
         expect(confirmed.status, `Reservation ${created.id} should become CONFIRMED.`).toBe(
            'CONFIRMED',
         );

         const arrived = await markReservationArrived(request, auth, created.id);
         expect(arrived.status, `Reservation ${created.id} should become ARRIVED.`).toBe('ARRIVED');

         const tableAfterArrive = await reloadTable(request, auth, table.id);
         expect(
            tableAfterArrive.status,
            `ARRIVED reservation ${created.id} should reserve table ${table.id}.`,
         ).toBe('RESERVED');

         const availabilityAfterArrive = await getAvailabilityForTable(request, auth, table.id, window);
         expect(
            availabilityAfterArrive.status,
            `Availability should expose live RESERVED status for table ${table.id}.`,
         ).toBe('RESERVED');
         expect(
            availabilityAfterArrive.reservations.map((reservation) => reservation.reservationId),
            `Availability should include arrived reservation ${created.id}.`,
         ).toContain(created.id);
         expect(
            availabilityAfterArrive.reservations.find(
               (reservation) => reservation.reservationId === created.id,
            )?.status,
            `Availability should show reservation ${created.id} as ARRIVED.`,
         ).toBe('ARRIVED');

         const completeAttempt = await requestText(
            request,
            'post',
            `${ENV.apiBaseUrl}/reservations/${encodeURIComponent(created.id)}/complete`,
            { headers: auth },
         );

         expect(
            completeAttempt.ok,
            [
               'Completing ARRIVED reservation before SEATED should be rejected.',
               `status: ${completeAttempt.status}`,
               `body: ${completeAttempt.text}`,
               `reservation id: ${created.id}`,
               `table id/name: ${table.id} / ${table.name}`,
            ].join('\n'),
         ).toBeFalsy();

         expect(
            [400, 409],
            `Invalid transition should return client/conflict error: ${completeAttempt.status} ${completeAttempt.text}`,
         ).toContain(completeAttempt.status);

         expect(
            errorCode(completeAttempt.text),
            `Invalid transition rejection should expose a stable error code. Body: ${completeAttempt.text}`,
         ).toBeTruthy();

         const afterRejectedComplete = await getReservation(request, auth, created.id);
         expect(
            afterRejectedComplete.status,
            `Rejected complete must keep reservation ${created.id} ARRIVED.`,
         ).toBe('ARRIVED');
         expect(
            afterRejectedComplete.completedAt,
            `Rejected complete must not set completedAt for reservation ${created.id}.`,
         ).toBeNull();

         const tableAfterRejectedComplete = await reloadTable(request, auth, table.id);
         expect(
            tableAfterRejectedComplete.status,
            `Rejected complete must keep table ${table.id} RESERVED.`,
         ).toBe('RESERVED');

         const availabilityAfterRejectedComplete = await getAvailabilityForTable(
            request,
            auth,
            table.id,
            window,
         );
         expect(
            availabilityAfterRejectedComplete.status,
            `Rejected complete should keep table ${table.id} RESERVED in availability.`,
         ).toBe('RESERVED');
         expect(
            availabilityAfterRejectedComplete.reservations.map((reservation) => reservation.reservationId),
            `Rejected complete should keep reservation ${created.id} blocking the window.`,
         ).toContain(created.id);
         expect(
            availabilityAfterRejectedComplete.reservations.find(
               (reservation) => reservation.reservationId === created.id,
            )?.status,
            `Availability should still show reservation ${created.id} as ARRIVED.`,
         ).toBe('ARRIVED');
      } finally {
         if (reservationId) {
            const reservation = await getReservation(request, auth, reservationId).catch(() => null);
            if (reservation && ACTIVE_RESERVATION_STATUSES.has(reservation.status)) {
               await cancelReservation(
                  request,
                  auth,
                  reservation.id,
                  'E2E reservation invalid-transition cleanup',
               ).catch(() => undefined);
            }
         }

         await resetInvalidTransitionTable(request, auth, table).catch(() => undefined);
      }
   });
});