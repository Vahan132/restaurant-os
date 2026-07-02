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
import { readFixtures } from '../../helpers/session';

const PARTIAL_PAYMENT_TABLE = {
   name: 'E2E Partial Payment',
   qrIdentifier: 'e2e-partial-payment',
} as const;

const PARTIAL_AMOUNT = 2000;

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

interface RecordPaymentResponse {
   payment: PaymentResponse;
   changeAmount: number;
   order: OrderResponse;
}

function errorCode(text: string): string | undefined {
   const body = parseJsonBody<ApiErrorBody>(text, 'POST /orders/:id/close partial payment response');
   return body.error?.code ?? body.code;
}

function activePayments(order: OrderResponse): PaymentResponse[] {
   return (order.payments ?? []).filter((payment) => payment.state === 'ACTIVE');
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

async function recordCashPayment(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   orderId: string,
   amount: number,
): Promise<RecordPaymentResponse> {
   const response = await requestText(
      request,
      'post',
      `${ENV.apiBaseUrl}/orders/${encodeURIComponent(orderId)}/payments`,
      {
         headers: auth,
         data: { method: 'CASH', amount, tenderedAmount: amount },
      },
   );

   if (!response.ok) {
      throw new Error(`POST /orders/${orderId}/payments failed: ${response.status} ${response.text}`);
   }

   return parseJsonBody<RecordPaymentResponse>(response.text, `POST /orders/${orderId}/payments`);
}

async function closeOrderRaw(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   orderId: string,
): Promise<RequestResult> {
   return requestText(
      request,
      'post',
      `${ENV.apiBaseUrl}/orders/${encodeURIComponent(orderId)}/close`,
      { headers: auth },
   );
}

async function closeOrderOk(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   orderId: string,
): Promise<OrderResponse> {
   const response = await closeOrderRaw(request, auth, orderId);

   if (!response.ok) {
      throw new Error(`POST /orders/${orderId}/close failed: ${response.status} ${response.text}`);
   }

   return parseJsonBody<OrderResponse>(response.text, `POST /orders/${orderId}/close`);
}

async function ensurePartialPaymentTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
): Promise<TableResponse> {
   const existing = (await listTables(request, auth)).find(
      (table) =>
         table.qrIdentifier === PARTIAL_PAYMENT_TABLE.qrIdentifier ||
         table.name === PARTIAL_PAYMENT_TABLE.name,
   );

   if (existing) return existing;

   const floors = await listFloors(request, auth);
   const floor = floors.find((candidate) => candidate.status === 'ACTIVE') ?? floors[0];

   if (!floor) {
      throw new Error('Cannot create partial-payment E2E table: GET /floors returned no floors.');
   }

   return createTable(request, auth, {
      floorId: floor.id,
      name: PARTIAL_PAYMENT_TABLE.name,
      seatCapacity: 4,
      qrIdentifier: PARTIAL_PAYMENT_TABLE.qrIdentifier,
   });
}

async function resetPartialPaymentTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   table: TableResponse,
): Promise<TableResponse> {
   const activeOrders = await listActiveOrdersForTable(request, auth, table.id);

   for (const order of activeOrders) {
      await cancelOrder(request, auth, order.id, 'E2E partial-payment setup cleanup').catch(
         () => undefined,
      );
   }

   const remainingOrders = await listActiveOrdersForTable(request, auth, table.id);
   expect(
      remainingOrders,
      [
         'Partial-payment setup could not clear active orders.',
         `table id/name: ${table.id} / ${table.name}`,
         `remaining order ids/statuses: ${remainingOrders.map((order) => `${order.id}:${order.status ?? '<unknown>'}`).join(', ') ||
         '<none>'
         }`,
      ].join('\n'),
   ).toHaveLength(0);

   const current = await getTable(request, auth, table.id);

   if (current.status === 'AVAILABLE') return current;

   if (current.status === 'CLEANING' || current.status === 'DISABLED') {
      return changeTableStatus(request, auth, table.id, 'AVAILABLE');
   }

   throw new Error(
      [
         `Table ${table.id} / ${table.name} could not be reset to AVAILABLE.`,
         `Current status: ${current.status}`,
      ].join('\n'),
   );
}

async function createServedOrder(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   table: TableResponse,
   fixture: CustomerOrderRequestFixture,
): Promise<OrderResponse> {
   const dish = requireCustomerOrderRequestFixture(fixture);

   const created = await createDineInOrder(request, auth, table.id);

   await addOrderItem(request, auth, created.id, {
      menuItemId: dish.dishId,
      quantity: 1,
      selectedOptionIds: dish.modifierOptionIds,
   });

   await sendOrderToKitchen(request, auth, created.id);

   const served = await markOrderServed(request, auth, created.id);

   expect(served.status, `Prepared partial-payment order ${created.id} should be SERVED.`).toBe(
      'SERVED',
   );
   expect(served.tableId, `Prepared order ${created.id} should stay on partial-payment table.`).toBe(
      table.id,
   );
   expect(served.paymentStatus, `Prepared order ${created.id} should start unpaid.`).toBe('UNPAID');
   expect(
      served.totals?.totalAmount,
      `Prepared order ${created.id} total should be positive.`,
   ).toBeGreaterThan(PARTIAL_AMOUNT);

   return served;
}

test.describe('POS partial payment', () => {
   test('records partial payment but does not allow closing until fully paid', async ({ request }) => {
      const fixture = readFixtures() as CustomerOrderRequestFixture;

      await expectApiHealth(request, { label: 'primary API for partial-payment test' });

      const auth = await seededOwnerAuthHeaders(request, fixture);
      const table = await resetPartialPaymentTable(
         request,
         auth,
         await ensurePartialPaymentTable(request, auth),
      );

      let orderId: string | undefined;

      try {
         const order = await createServedOrder(request, auth, table, fixture);
         orderId = order.id;

         const totalAmount = order.totals?.totalAmount;
         expect(totalAmount, `Order ${order.id} should have a total.`).toBeGreaterThan(PARTIAL_AMOUNT);

         const tableAfterCreate = await getTable(request, auth, table.id);
         expect(tableAfterCreate.status, `Table ${table.id} should be occupied after dine-in order.`).toBe(
            'OCCUPIED',
         );

         const partialPayment = await recordCashPayment(request, auth, order.id, PARTIAL_AMOUNT);
         expect(partialPayment.payment.method, 'Partial payment method should be CASH.').toBe('CASH');
         expect(partialPayment.payment.amount, 'Partial payment amount should match input.').toBe(
            PARTIAL_AMOUNT,
         );
         expect(
            partialPayment.payment.tenderedAmount,
            'Partial tendered amount should match input.',
         ).toBe(PARTIAL_AMOUNT);

         const afterPartial = await getOrder(request, auth, order.id);
         expect(afterPartial.status, `Partial payment should not close order ${order.id}.`).toBe(
            'SERVED',
         );
         expect(afterPartial.paymentStatus, `Partial payment should not mark order ${order.id} PAID.`).not.toBe(
            'PAID',
         );
         expect(afterPartial.paidAmount, `Order ${order.id} paidAmount should equal partial payment.`).toBe(
            PARTIAL_AMOUNT,
         );
         expect(afterPartial.totals?.totalAmount, `Partial payment must not change order total.`).toBe(
            totalAmount,
         );

         const activeAfterPartial = activePayments(afterPartial);
         expect(activeAfterPartial, `Order ${order.id} should have one active partial payment.`).toHaveLength(
            1,
         );
         expect(activeAfterPartial[0].amount, `Active payment should be partial amount.`).toBe(
            PARTIAL_AMOUNT,
         );

         const receiptAfterPartial = await getReceipt(request, auth, order.id);
         expect(receiptAfterPartial.paymentStatus, 'Receipt should not show PAID after partial payment.').not.toBe(
            'PAID',
         );
         expect(receiptAfterPartial.totalAmount, 'Receipt total should match order total.').toBe(
            totalAmount,
         );
         expect(receiptAfterPartial.payments, 'Receipt should include one partial payment.').toHaveLength(
            1,
         );
         expect(receiptAfterPartial.payments[0].amount, 'Receipt payment should equal partial amount.').toBe(
            PARTIAL_AMOUNT,
         );
         expect(receiptAfterPartial.closedAt, 'Receipt should not have closedAt before close.').toBeNull();

         const closeAttempt = await closeOrderRaw(request, auth, order.id);

         expect(
            closeAttempt.ok,
            [
               'Partially paid order should not close.',
               `status: ${closeAttempt.status}`,
               `body: ${closeAttempt.text}`,
               `order id: ${order.id}`,
               `table id/name: ${table.id} / ${table.name}`,
               `total: ${totalAmount}`,
               `paid: ${PARTIAL_AMOUNT}`,
            ].join('\n'),
         ).toBeFalsy();

         expect(
            [400, 409],
            `Closing partially paid order should return client/conflict error: ${closeAttempt.status} ${closeAttempt.text}`,
         ).toContain(closeAttempt.status);

         expect(
            errorCode(closeAttempt.text),
            `Close rejection should expose a stable error code. Body: ${closeAttempt.text}`,
         ).toBeTruthy();

         const afterRejectedClose = await getOrder(request, auth, order.id);
         expect(afterRejectedClose.status, `Rejected close should keep order ${order.id} served.`).toBe(
            'SERVED',
         );
         expect(
            afterRejectedClose.paidAmount,
            `Rejected close should keep paidAmount=${PARTIAL_AMOUNT}.`,
         ).toBe(PARTIAL_AMOUNT);

         const tableAfterRejectedClose = await getTable(request, auth, table.id);
         expect(
            tableAfterRejectedClose.status,
            `Rejected close should keep table ${table.id} OCCUPIED.`,
         ).toBe('OCCUPIED');

         const remainingAmount = (totalAmount ?? 0) - PARTIAL_AMOUNT;
         expect(remainingAmount, 'Remaining amount should be positive.').toBeGreaterThan(0);

         await recordCashPayment(request, auth, order.id, remainingAmount);

         const afterFullPayment = await getOrder(request, auth, order.id);
         expect(
            afterFullPayment.paidAmount,
            `Full payment should bring paidAmount to total for order ${order.id}.`,
         ).toBe(totalAmount);
         expect(afterFullPayment.paymentStatus, `Order ${order.id} should now be PAID.`).toBe('PAID');

         const closed = await closeOrderOk(request, auth, order.id);
         expect(closed.status, `Fully paid order ${order.id} should close.`).toBe('CLOSED');

         const tableAfterClose = await getTable(request, auth, table.id);
         expect(tableAfterClose.status, `Closed paid order should release table to CLEANING.`).toBe(
            'CLEANING',
         );

         const activeAfterClose = await listActiveOrdersForTable(request, auth, table.id);
         expect(activeAfterClose, `Table ${table.id} should have no active orders after close.`).toHaveLength(
            0,
         );

         orderId = undefined;
      } finally {
         if (orderId) {
            await cancelOrder(request, auth, orderId, 'E2E partial-payment cleanup').catch(
               () => undefined,
            );
         }

         await resetPartialPaymentTable(request, auth, table).catch(() => undefined);
      }
   });
});