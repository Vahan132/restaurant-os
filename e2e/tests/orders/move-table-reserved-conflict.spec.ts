import { test, expect, type APIRequestContext } from '@playwright/test';
import { expectApiHealth } from '../../helpers/health';
import {
   cancelOrder,
   changeTableStatus,
   createDineInOrder,
   createTable,
   getOrder,
   getTable,
   listActiveOrdersForTable,
   listFloors,
   listTables,
   moveOrderToTableRaw,
   parseJsonBody,
   seededOwnerAuthHeaders,
   type CustomerOrderRequestFixture,
   type OrderResponse,
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
   type ReservationResponse,
} from '../../helpers/reservations';
import { readFixtures } from '../../helpers/session';

const SOURCE_TABLE = {
   name: 'E2E Reserved Move Source',
   qrIdentifier: 'e2e-reserved-move-source',
} as const;

const TARGET_TABLE = {
   name: 'E2E Reserved Move Target',
   qrIdentifier: 'e2e-reserved-move-target',
} as const;

const RESERVATION_DURATION_MINUTES = 90;

const ACTIVE_ORDER_STATUSES = new Set([
   'DRAFT',
   'SENT_TO_KITCHEN',
   'PREPARING',
   'READY',
   'SERVED',
]);

interface ApiErrorBody {
   error?: {
      code?: string;
      message?: string;
   };
   code?: string;
   message?: string;
}

// A reservation window that is LIVE right now: it started a few minutes ago and
// runs for the full turn, so [reservedAt, reservedAt + duration) contains the
// current instant. The move-table guard treats a table as reserved only while a
// reservation's window is active now — a far-future reservation does not hold the
// table yet — so the conflict fixture must be current, not scheduled for later.
function activeReservationWindow(): {
   reservedAt: string;
   windowStart: string;
   windowEnd: string;
} {
   const start = new Date(Date.now() - 5 * 60_000);
   const end = new Date(start.getTime() + RESERVATION_DURATION_MINUTES * 60_000);

   return {
      reservedAt: start.toISOString(),
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
   };
}

async function ensureTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   input: { name: string; qrIdentifier: string },
): Promise<TableResponse> {
   const existing = (await listTables(request, auth)).find(
      (table) => table.qrIdentifier === input.qrIdentifier || table.name === input.name,
   );

   if (existing) return existing;

   const floors = await listFloors(request, auth);
   const floor = floors.find((candidate) => candidate.status === 'ACTIVE') ?? floors[0];

   if (!floor) {
      throw new Error(`Cannot create ${input.name}: GET /floors returned no floors.`);
   }

   return createTable(request, auth, {
      floorId: floor.id,
      name: input.name,
      seatCapacity: 2,
      qrIdentifier: input.qrIdentifier,
   });
}

async function resetTableForMoveReservedConflict(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   table: TableResponse,
): Promise<TableResponse> {
   await cancelActiveReservationsForTable(
      request,
      auth,
      table.id,
      'E2E reserved-table move conflict setup cleanup',
   );

   const activeOrders = await listActiveOrdersForTable(request, auth, table.id);
   for (const order of activeOrders) {
      await cancelOrder(request, auth, order.id, 'E2E reserved-table move conflict order cleanup');
   }

   const remainingOrders = await listActiveOrdersForTable(request, auth, table.id);
   expect(
      remainingOrders,
      [
         'Reserved-table move setup could not clear active orders.',
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
         'Expected reservation cancellation/order cleanup to release it.',
      ].join('\n'),
   );
}

function errorCode(text: string): string | undefined {
   const body = parseJsonBody<ApiErrorBody>(text, 'POST /orders/:id/move-table reserved conflict');
   return body.error?.code ?? body.code;
}

function expectActiveDineInOrder(order: OrderResponse, tableId: string, label: string): void {
   expect(order.id, `${label} should still exist.`).toBeTruthy();
   expect(order.tableId, `${label} should stay assigned to its original table.`).toBe(tableId);
   expect(order.status, `${label} should remain active.`).toBeTruthy();
   expect(ACTIVE_ORDER_STATUSES.has(order.status as string), `${label} should not be terminal.`).toBeTruthy();
}

async function createArrivedReservationForTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   table: TableResponse,
   window: ReturnType<typeof activeReservationWindow>,
): Promise<ReservationResponse> {
   const created = await createReservation(request, auth, {
      customerName: 'E2E Reserved Move Guest',
      customerPhone: '+374 99 000005',
      guestCount: 2,
      reservedAt: window.reservedAt,
      durationMinutes: RESERVATION_DURATION_MINUTES,
      tableId: table.id,
      notes: 'Created by reserved-table move conflict E2E',
   });

   expect(created.status, `Reservation ${created.id} should start PENDING.`).toBe('PENDING');
   expect(created.tableId, `Reservation ${created.id} should be assigned to target table.`).toBe(
      table.id,
   );

   const confirmed = await confirmReservation(request, auth, created.id);
   expect(confirmed.status, `Reservation ${created.id} should become CONFIRMED.`).toBe('CONFIRMED');

   const arrived = await markReservationArrived(request, auth, created.id);
   expect(arrived.status, `Reservation ${created.id} should become ARRIVED.`).toBe('ARRIVED');

   return arrived;
}

test.describe('order move-table reserved-table conflict', () => {
   test('rejects moving an active dine-in order onto a table reserved by a reservation', async ({
      request,
   }) => {
      const fixture = readFixtures() as CustomerOrderRequestFixture;

      await expectApiHealth(request, { label: 'primary API for reserved-table move conflict' });

      const auth = await seededOwnerAuthHeaders(request, fixture);

      const sourceTable = await resetTableForMoveReservedConflict(
         request,
         auth,
         await ensureTable(request, auth, SOURCE_TABLE),
      );
      const targetTable = await resetTableForMoveReservedConflict(
         request,
         auth,
         await ensureTable(request, auth, TARGET_TABLE),
      );

      expect(sourceTable.status, `Source table ${sourceTable.id} must start AVAILABLE.`).toBe(
         'AVAILABLE',
      );
      expect(targetTable.status, `Target table ${targetTable.id} must start AVAILABLE.`).toBe(
         'AVAILABLE',
      );

      const window = activeReservationWindow();
      const availabilityBefore = await getAvailabilityForTable(request, auth, targetTable.id, window);
      expect(availabilityBefore.status, `Target table ${targetTable.id} should start AVAILABLE.`).toBe(
         'AVAILABLE',
      );
      expect(
         availabilityBefore.reservations,
         `Target table ${targetTable.id} should not have active overlapping reservations before setup.`,
      ).toHaveLength(0);

      let sourceOrderId: string | undefined;
      let reservationId: string | undefined;

      try {
         const sourceOrder = await createDineInOrder(request, auth, sourceTable.id);
         sourceOrderId = sourceOrder.id;

         expectActiveDineInOrder(
            sourceOrder,
            sourceTable.id,
            `Source order ${sourceOrder.id}`,
         );

         const sourceTableAfterOrder = await getTable(request, auth, sourceTable.id);
         expect(
            sourceTableAfterOrder.status,
            `Source table ${sourceTable.id} should be OCCUPIED after creating source order.`,
         ).toBe('OCCUPIED');

         const reservation = await createArrivedReservationForTable(request, auth, targetTable, window);
         reservationId = reservation.id;

         const targetAfterReservation = await getTable(request, auth, targetTable.id);
         expect(
            targetAfterReservation.status,
            `Target table ${targetTable.id} should be RESERVED by reservation ${reservation.id}.`,
         ).toBe('RESERVED');

         const availabilityAfterReservation = await getAvailabilityForTable(
            request,
            auth,
            targetTable.id,
            window,
         );
         expect(
            availabilityAfterReservation.status,
            `Availability should expose live RESERVED target table ${targetTable.id}.`,
         ).toBe('RESERVED');
         expect(
            availabilityAfterReservation.reservations.map((item) => item.reservationId),
            `Availability should include target reservation ${reservation.id}.`,
         ).toContain(reservation.id);
         expect(
            availabilityAfterReservation.reservations.find(
               (item) => item.reservationId === reservation.id,
            )?.status,
            `Availability should show reservation ${reservation.id} as ARRIVED.`,
         ).toBe('ARRIVED');

         const rejectedMove = await moveOrderToTableRaw(
            request,
            auth,
            sourceOrder.id,
            targetTable.id,
         );

         expect(
            rejectedMove.ok,
            `Move to RESERVED table should be rejected, got ${rejectedMove.status}: ${rejectedMove.text}`,
         ).toBeFalsy();

         expect(
            [400, 409],
            `Move to RESERVED table should return a conflict/client error: ${rejectedMove.status} ${rejectedMove.text}`,
         ).toContain(rejectedMove.status);

         expect(
            errorCode(rejectedMove.text),
            `Move to RESERVED table should expose a stable error code. Body: ${rejectedMove.text}`,
         ).toBeTruthy();

         const sourceAfterMove = await getOrder(request, auth, sourceOrder.id);
         expectActiveDineInOrder(
            sourceAfterMove,
            sourceTable.id,
            `Source order ${sourceOrder.id}`,
         );

         const reservationAfterMove = await getReservation(request, auth, reservation.id);
         expect(
            reservationAfterMove.status,
            `Rejected move should not change reservation ${reservation.id}.`,
         ).toBe('ARRIVED');
         expect(
            reservationAfterMove.tableId,
            `Rejected move should keep reservation ${reservation.id} assigned to target table.`,
         ).toBe(targetTable.id);

         const sourceTableAfterMove = await getTable(request, auth, sourceTable.id);
         const targetTableAfterMove = await getTable(request, auth, targetTable.id);

         expect(
            sourceTableAfterMove.status,
            `Rejected move should leave source table ${sourceTable.id} OCCUPIED.`,
         ).toBe('OCCUPIED');
         expect(
            targetTableAfterMove.status,
            `Rejected move should leave target table ${targetTable.id} RESERVED.`,
         ).toBe('RESERVED');

         const sourceActiveOrders = await listActiveOrdersForTable(request, auth, sourceTable.id);
         const targetActiveOrders = await listActiveOrdersForTable(request, auth, targetTable.id);

         expect(
            sourceActiveOrders.map((order) => order.id),
            `Source table ${sourceTable.id} should still have exactly source order ${sourceOrder.id}.`,
         ).toEqual([sourceOrder.id]);
         expect(
            targetActiveOrders,
            `Target RESERVED table ${targetTable.id} should not receive an active order.`,
         ).toHaveLength(0);

         const availabilityAfterRejectedMove = await getAvailabilityForTable(
            request,
            auth,
            targetTable.id,
            window,
         );
         expect(
            availabilityAfterRejectedMove.status,
            `Rejected move should keep target table ${targetTable.id} RESERVED in availability.`,
         ).toBe('RESERVED');
         expect(
            availabilityAfterRejectedMove.reservations.map((item) => item.reservationId),
            `Rejected move should keep reservation ${reservation.id} blocking target table availability.`,
         ).toContain(reservation.id);
      } finally {
         if (sourceOrderId) {
            const order = await getOrder(request, auth, sourceOrderId).catch(() => null);
            if (order?.status && ACTIVE_ORDER_STATUSES.has(order.status)) {
               await cancelOrder(
                  request,
                  auth,
                  order.id,
                  'E2E reserved-table move conflict cleanup',
               ).catch(() => undefined);
            }
         }

         if (reservationId) {
            const reservation = await getReservation(request, auth, reservationId).catch(() => null);
            if (reservation && ACTIVE_RESERVATION_STATUSES.has(reservation.status)) {
               await cancelReservation(
                  request,
                  auth,
                  reservation.id,
                  'E2E reserved-table move conflict cleanup',
               ).catch(() => undefined);
            }
         }

         await resetTableForMoveReservedConflict(request, auth, sourceTable).catch(() => undefined);
         await resetTableForMoveReservedConflict(request, auth, targetTable).catch(() => undefined);
      }
   });
});