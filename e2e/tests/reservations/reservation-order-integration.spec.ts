import { test, expect, type APIRequestContext } from '@playwright/test';
import { ENV } from '../../config/env';
import { expectApiHealth } from '../../helpers/health';
import {
   addOrderItem,
   cancelOrder,
   changeTableStatus,
   createDineInOrder,
   createTable,
   getOrder,
   getReceipt,
   getTable,
   listActiveOrdersForTable,
   listFloors,
   listTables,
   markOrderServed,
   parseJsonBody,
   requireCustomerOrderRequestFixture,
   responseBodyText,
   seededOwnerAuthHeaders,
   sendOrderToKitchen,
   type CustomerOrderRequestFixture,
   type OrderResponse,
   type PaymentResponse,
   type PosAuthHeaders,
   type TableResponse,
} from '../../helpers/order-requests';
import {
   ACTIVE_RESERVATION_STATUSES,
   cancelActiveReservationsForTable,
   cancelReservation,
   completeReservation,
   confirmReservation,
   createReservation,
   getAvailabilityForTable,
   getReservation,
   markReservationArrived,
   markReservationSeated,
   reloadTable,
} from '../../helpers/reservations';
import { readFixtures } from '../../helpers/session';

const RESERVATION_DURATION_MINUTES = 90;
const RESERVATION_ORDER_TABLE_NAME = 'E2E Reservation Order Integration';
const RESERVATION_ORDER_TABLE_QR = 'e2e-reservation-order-integration';

interface RestaurantSettingsResponse {
   allowManualTableStatus: boolean;
}

interface RequestResult {
   status: number;
   ok: boolean;
   text: string;
}

interface RecordPaymentResponse {
   payment: PaymentResponse;
   order: OrderResponse;
}

function futureReservationWindow(): {
   reservedAt: string;
   windowStart: string;
   windowEnd: string;
} {
   const start = new Date();
   start.setUTCDate(start.getUTCDate() + 52);
   start.setUTCHours(18, 30, 0, 0);

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

async function ensureReservationOrderTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
): Promise<TableResponse> {
   const existing = (await listTables(request, auth)).find(
      (table) =>
         table.qrIdentifier === RESERVATION_ORDER_TABLE_QR ||
         table.name === RESERVATION_ORDER_TABLE_NAME,
   );

   if (existing) return existing;

   const floors = await listFloors(request, auth);
   const floor = floors.find((candidate) => candidate.status === 'ACTIVE') ?? floors[0];

   if (!floor) {
      throw new Error(
         'Cannot create reservation/order integration E2E table: GET /floors returned no floors.',
      );
   }

   return createTable(request, auth, {
      floorId: floor.id,
      name: RESERVATION_ORDER_TABLE_NAME,
      seatCapacity: 4,
      qrIdentifier: RESERVATION_ORDER_TABLE_QR,
   });
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

async function resetReservationOrderTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   table: TableResponse,
): Promise<TableResponse> {
   await cancelActiveReservationsForTable(
      request,
      auth,
      table.id,
      'E2E reservation/order integration setup cleanup',
   );

   const activeOrders = await listActiveOrdersForTable(request, auth, table.id);
   for (const order of activeOrders) {
      await cancelOrder(request, auth, order.id, 'E2E reservation/order integration order cleanup');
   }

   const remainingOrders = await listActiveOrdersForTable(request, auth, table.id);
   expect(
      remainingOrders,
      [
         'Reservation/order integration setup could not clear active orders.',
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

async function recordCashPayment(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   orderId: string,
   totalAmount: number,
): Promise<RecordPaymentResponse> {
   const response = await requestText(
      request,
      'post',
      `${ENV.apiBaseUrl}/orders/${encodeURIComponent(orderId)}/payments`,
      {
         headers: auth,
         data: {
            method: 'CASH',
            amount: totalAmount,
            tenderedAmount: totalAmount,
         },
      },
   );

   if (!response.ok) {
      throw new Error(`POST /orders/${orderId}/payments failed: ${response.status} ${response.text}`);
   }

   return parseJsonBody<RecordPaymentResponse>(response.text, `POST /orders/${orderId}/payments`);
}

async function closeOrder(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   orderId: string,
): Promise<OrderResponse> {
   const response = await requestText(
      request,
      'post',
      `${ENV.apiBaseUrl}/orders/${encodeURIComponent(orderId)}/close`,
      { headers: auth },
   );

   if (!response.ok) {
      throw new Error(`POST /orders/${orderId}/close failed: ${response.status} ${response.text}`);
   }

   return parseJsonBody<OrderResponse>(response.text, `POST /orders/${orderId}/close`);
}

function activePayments(order: OrderResponse): PaymentResponse[] {
   return (order.payments ?? []).filter((payment) => payment.state === 'ACTIVE');
}

async function prepareServedOrderForReservationTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   table: TableResponse,
   fixture: CustomerOrderRequestFixture,
): Promise<OrderResponse> {
   const dish = requireCustomerOrderRequestFixture(fixture);

   const tableBeforeOrder = await reloadTable(request, auth, table.id);
   expect(
      tableBeforeOrder.status,
      `Order for reservation table ${table.id} should be created while table is RESERVED after arrival.`,
   ).toBe('RESERVED');

   const created = await createDineInOrder(request, auth, table.id);
   expect(
      created.tableId,
      `Order ${created.id} should be created on arrived reservation table ${table.id}.`,
   ).toBe(table.id);

   const tableAfterCreate = await reloadTable(request, auth, table.id);
   expect(
      tableAfterCreate.status,
      `Creating order ${created.id} on reserved reservation table should occupy table ${table.id}.`,
   ).toBe('OCCUPIED');

   await addOrderItem(request, auth, created.id, {
      menuItemId: dish.dishId,
      quantity: 1,
      selectedOptionIds: dish.modifierOptionIds,
   });

   const sent = await sendOrderToKitchen(request, auth, created.id);
   expect(sent.status, `Order ${created.id} should move to SENT_TO_KITCHEN.`).toBe(
      'SENT_TO_KITCHEN',
   );

   const served = await markOrderServed(request, auth, created.id);
   expect(served.status, `Order ${created.id} should move to SERVED.`).toBe('SERVED');
   expect(served.paymentStatus, `Order ${created.id} should start unpaid.`).toBe('UNPAID');
   expect(
      served.totals?.totalAmount,
      `Order ${created.id} should have positive total.`,
   ).toBeGreaterThan(0);

   return served;
}

test.describe('reservation/order integration', () => {
   test('order checkout releases a table occupied by a seated/completed reservation', async ({
      request,
   }) => {
      const fixture = readFixtures() as CustomerOrderRequestFixture;

      await expectApiHealth(request, { label: 'primary API for reservation/order integration' });

      const auth = await seededOwnerAuthHeaders(request, fixture);
      const table = await resetReservationOrderTable(
         request,
         auth,
         await ensureReservationOrderTable(request, auth),
      );

      expect(
         table.status,
         `Reservation/order integration table ${table.id} must start AVAILABLE.`,
      ).toBe('AVAILABLE');

      const window = futureReservationWindow();

      const availabilityBefore = await getAvailabilityForTable(request, auth, table.id, window);
      expect(availabilityBefore.status, `Table ${table.id} should be AVAILABLE before reservation.`).toBe(
         'AVAILABLE',
      );
      expect(
         availabilityBefore.reservations,
         `Table ${table.id} should not have overlapping active reservations before test.`,
      ).toHaveLength(0);

      let reservationId: string | undefined;
      let orderId: string | undefined;

      try {
         const createdReservation = await createReservation(request, auth, {
            customerName: 'E2E Reservation Order Integration',
            customerPhone: '+374 99 000004',
            guestCount: 2,
            reservedAt: window.reservedAt,
            durationMinutes: RESERVATION_DURATION_MINUTES,
            tableId: table.id,
            notes: 'Created by reservation/order integration E2E',
         });

         reservationId = createdReservation.id;

         expect(createdReservation.status, `Reservation ${createdReservation.id} should start PENDING.`).toBe(
            'PENDING',
         );
         expect(
            createdReservation.tableId,
            `Reservation ${createdReservation.id} should be assigned to E2E table.`,
         ).toBe(table.id);

         const confirmed = await confirmReservation(request, auth, createdReservation.id);
         expect(confirmed.status, `Reservation ${createdReservation.id} should become CONFIRMED.`).toBe(
            'CONFIRMED',
         );

         const arrived = await markReservationArrived(request, auth, createdReservation.id);
         expect(arrived.status, `Reservation ${createdReservation.id} should become ARRIVED.`).toBe(
            'ARRIVED',
         );

         const tableAfterArrive = await reloadTable(request, auth, table.id);
         expect(
            tableAfterArrive.status,
            `ARRIVED reservation ${createdReservation.id} should reserve table ${table.id}.`,
         ).toBe('RESERVED');

         const availabilityAfterArrive = await getAvailabilityForTable(request, auth, table.id, window);
         expect(
            availabilityAfterArrive.status,
            `Availability should expose live RESERVED status for arrived table ${table.id}.`,
         ).toBe('RESERVED');
         expect(
            availabilityAfterArrive.reservations.map((reservation) => reservation.reservationId),
            `Availability should include arrived reservation ${createdReservation.id}.`,
         ).toContain(createdReservation.id);
         expect(
            availabilityAfterArrive.reservations.find(
               (reservation) => reservation.reservationId === createdReservation.id,
            )?.status,
            `Availability should show reservation ${createdReservation.id} as ARRIVED.`,
         ).toBe('ARRIVED');

         const servedOrder = await prepareServedOrderForReservationTable(
            request,
            auth,
            table,
            fixture,
         );
         orderId = servedOrder.id;

         const activeAfterOrderCreate = await listActiveOrdersForTable(request, auth, table.id);
         expect(
            activeAfterOrderCreate.map((order) => order.id),
            `Table ${table.id} should have the reservation service order active.`,
         ).toContain(servedOrder.id);
         expect(
            activeAfterOrderCreate,
            `Table ${table.id} should have exactly one active order.`,
         ).toHaveLength(1);

         const tableAfterOrderCreate = await reloadTable(request, auth, table.id);
         expect(
            tableAfterOrderCreate.status,
            `Table ${table.id} should be OCCUPIED after opening the reservation service order.`,
         ).toBe('OCCUPIED');

         const seated = await markReservationSeated(request, auth, createdReservation.id);
         expect(seated.status, `Reservation ${createdReservation.id} should become SEATED.`).toBe(
            'SEATED',
         );

         const tableAfterSeat = await reloadTable(request, auth, table.id);
         expect(
            tableAfterSeat.status,
            `SEATING reservation ${createdReservation.id} should keep table ${table.id} OCCUPIED while order is active.`,
         ).toBe('OCCUPIED');

         const availabilityAfterSeat = await getAvailabilityForTable(request, auth, table.id, window);
         expect(
            availabilityAfterSeat.status,
            `Availability should expose live OCCUPIED status for seated table ${table.id}.`,
         ).toBe('OCCUPIED');
         expect(
            availabilityAfterSeat.reservations.map((reservation) => reservation.reservationId),
            `Availability should include seated reservation ${createdReservation.id}.`,
         ).toContain(createdReservation.id);
         expect(
            availabilityAfterSeat.reservations.find(
               (reservation) => reservation.reservationId === createdReservation.id,
            )?.status,
            `Availability should show reservation ${createdReservation.id} as SEATED.`,
         ).toBe('SEATED');

         const completedReservation = await completeReservation(request, auth, createdReservation.id);
         expect(
            completedReservation.status,
            `Reservation ${createdReservation.id} should become COMPLETED.`,
         ).toBe('COMPLETED');
         expect(
            completedReservation.completedAt,
            `Reservation ${createdReservation.id} should record completedAt.`,
         ).toBeTruthy();

         const tableAfterReservationComplete = await reloadTable(request, auth, table.id);
         expect(
            tableAfterReservationComplete.status,
            'Completing the reservation must not release the table while the order is active.',
         ).toBe('OCCUPIED');

         const availabilityAfterReservationComplete = await getAvailabilityForTable(
            request,
            auth,
            table.id,
            window,
         );
         expect(
            availabilityAfterReservationComplete.status,
            `Availability should expose live OCCUPIED status for table ${table.id} while service order is active.`,
         ).toBe('OCCUPIED');
         expect(
            availabilityAfterReservationComplete.reservations.map(
               (reservation) => reservation.reservationId,
            ),
            `Completed reservation ${createdReservation.id} should not continue blocking the reservation window.`,
         ).not.toContain(createdReservation.id);

         const totalAmount = servedOrder.totals?.totalAmount;
         expect(totalAmount, `Served order ${servedOrder.id} must have totalAmount.`).toBeGreaterThan(0);

         if (typeof totalAmount !== 'number' || totalAmount <= 0) {
            throw new Error(`Served order ${servedOrder.id} did not have a valid totalAmount.`);
         }

         const payment = await recordCashPayment(request, auth, servedOrder.id, totalAmount);
         expect(payment.payment.method, `Order ${servedOrder.id} payment should be CASH.`).toBe('CASH');
         expect(payment.payment.amount, `Order ${servedOrder.id} payment amount should equal total.`).toBe(
            totalAmount,
         );
         expect(
            payment.payment.tenderedAmount,
            `Order ${servedOrder.id} tendered amount should equal total.`,
         ).toBe(totalAmount);
         expect(payment.order.paymentStatus, `Full payment should mark order ${servedOrder.id} PAID.`).toBe(
            'PAID',
         );

         const closed = await closeOrder(request, auth, servedOrder.id);
         expect(closed.status, `Order ${servedOrder.id} should become CLOSED.`).toBe('CLOSED');
         expect(closed.paymentStatus, `Order ${servedOrder.id} should remain PAID after close.`).toBe(
            'PAID',
         );
         expect(closed.totals?.totalAmount, `Order ${servedOrder.id} total should not change on close.`).toBe(
            totalAmount,
         );

         const reloadedClosedOrder = await getOrder(request, auth, servedOrder.id);
         expect(reloadedClosedOrder.status, `Reloaded order ${servedOrder.id} should be CLOSED.`).toBe(
            'CLOSED',
         );
         expect(reloadedClosedOrder.paymentStatus, `Reloaded order ${servedOrder.id} should be PAID.`).toBe(
            'PAID',
         );
         expect(
            activePayments(reloadedClosedOrder),
            `Closed order ${servedOrder.id} should have one active payment.`,
         ).toHaveLength(1);

         const receipt = await getReceipt(request, auth, servedOrder.id);
         expect(receipt.paymentStatus, `Receipt for order ${servedOrder.id} should be PAID.`).toBe('PAID');
         expect(receipt.totalAmount, `Receipt total for order ${servedOrder.id} should match order total.`).toBe(
            totalAmount,
         );
         expect(receipt.payments, `Receipt for order ${servedOrder.id} should include one payment.`).toHaveLength(
            1,
         );
         expect(receipt.payments[0].amount, `Receipt payment amount should equal order total.`).toBe(
            totalAmount,
         );
         expect(receipt.closedAt, `Receipt for order ${servedOrder.id} should include closedAt.`).toBeTruthy();

         const tableAfterOrderClose = await getTable(request, auth, table.id);
         expect(
            tableAfterOrderClose.status,
            `Closing the reservation service order should release table ${table.id} to CLEANING.`,
         ).toBe('CLEANING');

         const activeAfterClose = await listActiveOrdersForTable(request, auth, table.id);
         expect(
            activeAfterClose,
            `Table ${table.id} should have no active orders after checkout close.`,
         ).toHaveLength(0);

         const reservationAfterOrderClose = await getReservation(request, auth, createdReservation.id);
         expect(
            reservationAfterOrderClose.status,
            `Closing the order should not regress completed reservation ${createdReservation.id}.`,
         ).toBe('COMPLETED');

         const availabilityAfterOrderClose = await getAvailabilityForTable(request, auth, table.id, window);
         expect(
            availabilityAfterOrderClose.status,
            `Availability should expose live CLEANING status for table ${table.id} after checkout close.`,
         ).toBe('CLEANING');
         expect(
            availabilityAfterOrderClose.reservations.map((reservation) => reservation.reservationId),
            `Completed reservation ${createdReservation.id} should stay non-blocking after order close.`,
         ).not.toContain(createdReservation.id);
      } finally {
         if (orderId) {
            const order = await getOrder(request, auth, orderId).catch(() => null);
            if (order?.status && !['CLOSED', 'CANCELLED'].includes(order.status)) {
               await cancelOrder(
                  request,
                  auth,
                  order.id,
                  'E2E reservation/order integration cleanup',
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
                  'E2E reservation/order integration cleanup',
               ).catch(() => undefined);
            }
         }

         await resetReservationOrderTable(request, auth, table).catch(() => undefined);
      }
   });
});