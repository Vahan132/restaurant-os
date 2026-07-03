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

const VOID_PAYMENT_TABLE = {
   name: 'E2E Void Payment',
   qrIdentifier: 'e2e-void-payment',
} as const;

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

function activePayments(order: OrderResponse): PaymentResponse[] {
   return (order.payments ?? []).filter((payment) => payment.state === 'ACTIVE');
}

function findPayment(order: OrderResponse, paymentId: string): PaymentResponse | undefined {
   return (order.payments ?? []).find((payment) => payment.id === paymentId);
}

function errorCode(text: string): string | undefined {
   const body = parseJsonBody<ApiErrorBody>(text, 'POST /orders/:id/close void-payment response');
   return body.error?.code ?? body.code;
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

async function voidPaymentOk(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   orderId: string,
   paymentId: string,
): Promise<OrderResponse> {
   const response = await requestText(
      request,
      'post',
      `${ENV.apiBaseUrl}/orders/${encodeURIComponent(orderId)}/payments/${encodeURIComponent(paymentId)}/void`,
      {
         headers: auth,
         data: { reason: 'E2E void-payment test before order close' },
      },
   );

   if (!response.ok) {
      throw new Error(
         `POST /orders/${orderId}/payments/${paymentId}/void failed: ${response.status} ${response.text}`,
      );
   }

   return parseJsonBody<OrderResponse>(
      response.text,
      `POST /orders/${orderId}/payments/${paymentId}/void`,
   );
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

async function ensureVoidPaymentTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
): Promise<TableResponse> {
   const existing = (await listTables(request, auth)).find(
      (table) =>
         table.qrIdentifier === VOID_PAYMENT_TABLE.qrIdentifier ||
         table.name === VOID_PAYMENT_TABLE.name,
   );

   if (existing) return existing;

   const floors = await listFloors(request, auth);
   const floor = floors.find((candidate) => candidate.status === 'ACTIVE') ?? floors[0];

   if (!floor) {
      throw new Error('Cannot create void-payment E2E table: GET /floors returned no floors.');
   }

   return createTable(request, auth, {
      floorId: floor.id,
      name: VOID_PAYMENT_TABLE.name,
      seatCapacity: 4,
      qrIdentifier: VOID_PAYMENT_TABLE.qrIdentifier,
   });
}

async function resetVoidPaymentTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   table: TableResponse,
): Promise<TableResponse> {
   const activeOrders = await listActiveOrdersForTable(request, auth, table.id);

   for (const order of activeOrders) {
      await cancelOrder(request, auth, order.id, 'E2E void-payment setup cleanup').catch(
         () => undefined,
      );
   }

   const remainingOrders = await listActiveOrdersForTable(request, auth, table.id);
   expect(
      remainingOrders,
      [
         'Void-payment setup could not clear active orders.',
         `table id/name: ${table.id} / ${table.name}`,
         `remaining order ids/statuses: ${
            remainingOrders.map((order) => `${order.id}:${order.status ?? '<unknown>'}`).join(', ') ||
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

   expect(served.status, `Prepared void-payment order ${created.id} should be SERVED.`).toBe(
      'SERVED',
   );
   expect(served.tableId, `Prepared order ${created.id} should stay on void-payment table.`).toBe(
      table.id,
   );
   expect(served.paymentStatus, `Prepared order ${created.id} should start unpaid.`).toBe('UNPAID');
   expect(served.paidAmount, `Prepared order ${created.id} should start with no paid amount.`).toBe(0);
   expect(served.totals?.totalAmount, `Prepared order ${created.id} should have total.`).toBeGreaterThan(
      0,
   );

   return served;
}

test.describe('POS void payment', () => {
   test('voids a full payment before close and requires a valid replacement payment to close', async ({
      request,
   }) => {
      const fixture = readFixtures() as CustomerOrderRequestFixture;

      await expectApiHealth(request, { label: 'primary API for void-payment test' });

      const auth = await seededOwnerAuthHeaders(request, fixture);
      const table = await resetVoidPaymentTable(
         request,
         auth,
         await ensureVoidPaymentTable(request, auth),
      );

      let orderId: string | undefined;

      try {
         const order = await createServedOrder(request, auth, table, fixture);
         orderId = order.id;

         const totalAmount = order.totals?.totalAmount;
         expect(totalAmount, `Order ${order.id} should have a positive total.`).toBeGreaterThan(0);

         const firstPayment = await recordCashPayment(request, auth, order.id, totalAmount ?? 0);
         expect(firstPayment.payment.method, 'Full payment method should be CASH.').toBe('CASH');
         expect(firstPayment.payment.amount, 'Full payment should equal order total.').toBe(totalAmount);
         expect(firstPayment.payment.tenderedAmount, 'Full tendered amount should equal order total.').toBe(
            totalAmount,
         );
         expect(firstPayment.payment.state, 'Newly recorded payment should be active.').toBe('ACTIVE');
         expect(firstPayment.changeAmount, 'Exact cash payment should not create change.').toBe(0);

         const afterPayment = await getOrder(request, auth, order.id);
         expect(afterPayment.status, `Full payment should not close order ${order.id}.`).toBe('SERVED');
         expect(afterPayment.paymentStatus, `Full payment should mark order ${order.id} PAID.`).toBe(
            'PAID',
         );
         expect(afterPayment.paidAmount, `Order ${order.id} paidAmount should equal total.`).toBe(
            totalAmount,
         );
         expect(afterPayment.totals?.totalAmount, `Full payment must not change order total.`).toBe(
            totalAmount,
         );

         const activeAfterPayment = activePayments(afterPayment);
         expect(activeAfterPayment, `Order ${order.id} should have one active payment.`).toHaveLength(1);
         expect(activeAfterPayment[0].id, 'Active payment should be the recorded payment.').toBe(
            firstPayment.payment.id,
         );

         const tableAfterPayment = await getTable(request, auth, table.id);
         expect(tableAfterPayment.status, `Paid but open table ${table.id} should stay OCCUPIED.`).toBe(
            'OCCUPIED',
         );

         const voidedOrder = await voidPaymentOk(request, auth, order.id, firstPayment.payment.id);
         expect(voidedOrder.id, 'Void endpoint should return the updated order.').toBe(order.id);
         expect(voidedOrder.status, `Voiding payment should keep order ${order.id} served.`).toBe(
            'SERVED',
         );
         expect(voidedOrder.paymentStatus, `Voiding payment should make order ${order.id} unpaid.`).toBe(
            'UNPAID',
         );
         expect(voidedOrder.paidAmount, `Voiding payment should reset paidAmount for ${order.id}.`).toBe(
            0,
         );
         expect(voidedOrder.totals?.totalAmount, `Voiding payment must not change order total.`).toBe(
            totalAmount,
         );

         const voidedPayment = findPayment(voidedOrder, firstPayment.payment.id);
         expect(voidedPayment, `Voided payment ${firstPayment.payment.id} should remain visible on order.`).toBeTruthy();
         expect(voidedPayment?.state, `Payment ${firstPayment.payment.id} should be VOIDED after void.`).toBe(
            'VOIDED',
         );
         expect(
            activePayments(voidedOrder),
            `Order ${order.id} should have no active payments after void.`,
         ).toHaveLength(0);

         const afterVoid = await getOrder(request, auth, order.id);
         expect(afterVoid.status, `Fetched order ${order.id} should still be served after void.`).toBe(
            'SERVED',
         );
         expect(afterVoid.paymentStatus, `Fetched order ${order.id} should be unpaid after void.`).toBe(
            'UNPAID',
         );
         expect(afterVoid.paidAmount, `Fetched order ${order.id} paidAmount should be zero after void.`).toBe(
            0,
         );
         expect(findPayment(afterVoid, firstPayment.payment.id)?.state).toBe('VOIDED');

         const receiptAfterVoid = await getReceipt(request, auth, order.id);
         expect(receiptAfterVoid.paymentStatus, 'Receipt should show UNPAID after payment void.').toBe(
            'UNPAID',
         );
         expect(receiptAfterVoid.totalAmount, 'Receipt total should stay unchanged after void.').toBe(
            totalAmount,
         );
         expect(
            receiptAfterVoid.payments,
            'Receipt should not count voided payments as paid.',
         ).toHaveLength(0);
         expect(receiptAfterVoid.closedAt, 'Receipt should not have closedAt before close.').toBeNull();

         const closeAttempt = await closeOrderRaw(request, auth, order.id);

         expect(
            closeAttempt.ok,
            [
               'Order should not close after its only payment is voided.',
               `status: ${closeAttempt.status}`,
               `body: ${closeAttempt.text}`,
               `order id: ${order.id}`,
               `table id/name: ${table.id} / ${table.name}`,
               `total: ${totalAmount}`,
               'paid: 0',
            ].join('\n'),
         ).toBeFalsy();

         expect(
            [400, 409],
            `Closing unpaid order should return client/conflict error: ${closeAttempt.status} ${closeAttempt.text}`,
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
            afterRejectedClose.paymentStatus,
            `Rejected close should keep order ${order.id} unpaid.`,
         ).toBe('UNPAID');
         expect(afterRejectedClose.paidAmount, 'Rejected close should keep paidAmount at zero.').toBe(0);

         const tableAfterRejectedClose = await getTable(request, auth, table.id);
         expect(
            tableAfterRejectedClose.status,
            `Rejected close should keep table ${table.id} OCCUPIED.`,
         ).toBe('OCCUPIED');

         const replacementPayment = await recordCashPayment(request, auth, order.id, totalAmount ?? 0);
         expect(replacementPayment.payment.id, 'Replacement payment should be a new payment.').not.toBe(
            firstPayment.payment.id,
         );
         expect(replacementPayment.payment.state, 'Replacement payment should be active.').toBe('ACTIVE');
         expect(replacementPayment.payment.amount, 'Replacement payment should equal order total.').toBe(
            totalAmount,
         );

         const afterReplacementPayment = await getOrder(request, auth, order.id);
         expect(afterReplacementPayment.status, `Replacement payment should keep order ${order.id} served.`).toBe(
            'SERVED',
         );
         expect(
            afterReplacementPayment.paymentStatus,
            `Replacement payment should mark order ${order.id} paid.`,
         ).toBe('PAID');
         expect(
            afterReplacementPayment.paidAmount,
            `Replacement payment should bring paidAmount to total for ${order.id}.`,
         ).toBe(totalAmount);
         expect(activePayments(afterReplacementPayment)).toHaveLength(1);
         expect(activePayments(afterReplacementPayment)[0].id).toBe(replacementPayment.payment.id);
         expect(findPayment(afterReplacementPayment, firstPayment.payment.id)?.state).toBe('VOIDED');

         const closed = await closeOrderOk(request, auth, order.id);
         expect(closed.status, `Fully paid order ${order.id} should close.`).toBe('CLOSED');
         expect(closed.paymentStatus, `Closed order ${order.id} should stay PAID.`).toBe('PAID');

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
            const order = await getOrder(request, auth, orderId).catch(() => null);
            if (order?.status && !['CLOSED', 'CANCELLED'].includes(order.status)) {
               await cancelOrder(request, auth, order.id, 'E2E void-payment cleanup').catch(
                  () => undefined,
               );
            }
         }

         await resetVoidPaymentTable(request, auth, table).catch(() => undefined);
      }
   });
});
