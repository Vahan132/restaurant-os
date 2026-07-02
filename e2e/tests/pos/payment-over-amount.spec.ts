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

const PAYMENT_OVER_AMOUNT_TABLE = {
   name: 'E2E Payment Over Amount',
   qrIdentifier: 'e2e-payment-over-amount',
} as const;

const EXTRA_AMOUNT = 1000;

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

interface ReceiptPaymentLike {
   amount?: number;
   tenderedAmount?: number;
   method?: string;
   state?: string;
}

interface ReceiptLike {
   orderId?: string;
   totalAmount?: number;
   paidAmount?: number;
   paymentStatus?: string;
   closedAt?: string | null;
   payments?: ReceiptPaymentLike[];
}

function activePayments(order: OrderResponse): PaymentResponse[] {
   return (order.payments ?? []).filter((payment) => payment.state === 'ACTIVE');
}

function receiptPayments(receipt: ReceiptLike): ReceiptPaymentLike[] {
   return receipt.payments ?? [];
}

function errorCode(text: string): string | undefined {
   const body = parseJsonBody<ApiErrorBody>(text, 'POST /orders/:id/payments over-amount response');
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

async function recordCashPaymentRaw(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   orderId: string,
   amount: number,
   tenderedAmount: number,
): Promise<RequestResult> {
   return requestText(
      request,
      'post',
      `${ENV.apiBaseUrl}/orders/${encodeURIComponent(orderId)}/payments`,
      {
         headers: auth,
         data: { method: 'CASH', amount, tenderedAmount },
      },
   );
}

async function recordCashPaymentOk(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   orderId: string,
   amount: number,
   tenderedAmount: number,
): Promise<RecordPaymentResponse> {
   const response = await recordCashPaymentRaw(request, auth, orderId, amount, tenderedAmount);

   if (!response.ok) {
      throw new Error(
         `POST /orders/${orderId}/payments failed: ${response.status} ${response.text}`,
      );
   }

   return parseJsonBody<RecordPaymentResponse>(response.text, `POST /orders/${orderId}/payments`);
}

async function closeOrderOk(
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

async function ensurePaymentOverAmountTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
): Promise<TableResponse> {
   const existing = (await listTables(request, auth)).find(
      (table) =>
         table.qrIdentifier === PAYMENT_OVER_AMOUNT_TABLE.qrIdentifier ||
         table.name === PAYMENT_OVER_AMOUNT_TABLE.name,
   );

   if (existing) return existing;

   const floors = await listFloors(request, auth);
   const floor = floors.find((candidate) => candidate.status === 'ACTIVE') ?? floors[0];

   if (!floor) {
      throw new Error('Cannot create payment-over-amount E2E table: GET /floors returned no floors.');
   }

   return createTable(request, auth, {
      floorId: floor.id,
      name: PAYMENT_OVER_AMOUNT_TABLE.name,
      seatCapacity: 4,
      qrIdentifier: PAYMENT_OVER_AMOUNT_TABLE.qrIdentifier,
   });
}

async function resetPaymentOverAmountTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   table: TableResponse,
): Promise<TableResponse> {
   const activeOrders = await listActiveOrdersForTable(request, auth, table.id);

   for (const order of activeOrders) {
      await cancelOrder(request, auth, order.id, 'E2E payment-over-amount setup cleanup').catch(
         () => undefined,
      );
   }

   const remainingOrders = await listActiveOrdersForTable(request, auth, table.id);
   expect(
      remainingOrders,
      [
         'Payment-over-amount setup could not clear active orders.',
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

   expect(served.status, `Prepared payment-over-amount order ${created.id} should be SERVED.`).toBe(
      'SERVED',
   );
   expect(served.tableId, `Prepared order ${created.id} should stay on payment-over-amount table.`).toBe(
      table.id,
   );
   expect(served.paymentStatus, `Prepared order ${created.id} should start unpaid.`).toBe('UNPAID');
   expect(served.paidAmount, `Prepared order ${created.id} should start with no paid amount.`).toBe(0);
   expect(served.totals?.totalAmount, `Prepared order ${created.id} should have total.`).toBeGreaterThan(
      0,
   );

   return served;
}

test.describe('POS payment over amount', () => {
   test('rejects payment amount greater than remaining order total', async ({ request }) => {
      const fixture = readFixtures() as CustomerOrderRequestFixture;

      await expectApiHealth(request, { label: 'primary API for payment-over-amount test' });

      const auth = await seededOwnerAuthHeaders(request, fixture);
      const table = await resetPaymentOverAmountTable(
         request,
         auth,
         await ensurePaymentOverAmountTable(request, auth),
      );

      let orderId: string | undefined;

      try {
         const order = await createServedOrder(request, auth, table, fixture);
         orderId = order.id;

         const totalAmount = order.totals?.totalAmount;
         expect(totalAmount, `Order ${order.id} should have a positive total.`).toBeGreaterThan(0);

         const invalidAmount = (totalAmount ?? 0) + EXTRA_AMOUNT;

         const tableAfterCreate = await getTable(request, auth, table.id);
         expect(tableAfterCreate.status, `Table ${table.id} should be occupied after dine-in order.`).toBe(
            'OCCUPIED',
         );

         const invalidPayment = await recordCashPaymentRaw(
            request,
            auth,
            order.id,
            invalidAmount,
            invalidAmount,
         );

         expect(
            invalidPayment.ok,
            [
               'Payment amount greater than order total should be rejected.',
               `status: ${invalidPayment.status}`,
               `body: ${invalidPayment.text}`,
               `order id: ${order.id}`,
               `table id/name: ${table.id} / ${table.name}`,
               `total: ${totalAmount}`,
               `attempted amount: ${invalidAmount}`,
            ].join('\n'),
         ).toBeFalsy();

         expect(
            [400, 409],
            `Over-amount payment should return client/conflict error: ${invalidPayment.status} ${invalidPayment.text}`,
         ).toContain(invalidPayment.status);

         expect(
            errorCode(invalidPayment.text),
            `Over-amount payment rejection should expose a stable error code. Body: ${invalidPayment.text}`,
         ).toBeTruthy();

         const afterRejectedPayment = await getOrder(request, auth, order.id);
         expect(afterRejectedPayment.status, `Rejected over-payment should keep order ${order.id} served.`).toBe(
            'SERVED',
         );
         expect(
            afterRejectedPayment.paymentStatus,
            `Rejected over-payment should keep order ${order.id} unpaid.`,
         ).toBe('UNPAID');
         expect(afterRejectedPayment.paidAmount, `Rejected over-payment should not change paidAmount.`).toBe(
            0,
         );
         expect(afterRejectedPayment.totals?.totalAmount, `Rejected over-payment should not change total.`).toBe(
            totalAmount,
         );
         expect(
            activePayments(afterRejectedPayment),
            `Rejected over-payment should not create active payments on order ${order.id}.`,
         ).toHaveLength(0);

         const receiptAfterRejectedPayment = (await getReceipt(request, auth, order.id)) as ReceiptLike;
         expect(
            receiptAfterRejectedPayment.paymentStatus,
            'Receipt should remain UNPAID after rejected over-payment.',
         ).toBe('UNPAID');
         expect(receiptAfterRejectedPayment.totalAmount, 'Receipt total should stay unchanged.').toBe(
            totalAmount,
         );
         expect(
            receiptPayments(receiptAfterRejectedPayment),
            'Receipt should not include rejected over-payment.',
         ).toHaveLength(0);
         expect(receiptAfterRejectedPayment.closedAt, 'Receipt should not be closed.').toBeNull();

         const tableAfterRejectedPayment = await getTable(request, auth, table.id);
         expect(
            tableAfterRejectedPayment.status,
            `Rejected over-payment should keep table ${table.id} OCCUPIED.`,
         ).toBe('OCCUPIED');

         const validPayment = await recordCashPaymentOk(
            request,
            auth,
            order.id,
            totalAmount ?? 0,
            totalAmount ?? 0,
         );

         expect(validPayment.payment.amount, 'Valid payment should apply exact order total.').toBe(
            totalAmount,
         );
         expect(validPayment.changeAmount, 'Exact cash payment should not create change.').toBe(0);

         const afterValidPayment = await getOrder(request, auth, order.id);
         expect(afterValidPayment.paymentStatus, `Order ${order.id} should be PAID after valid payment.`).toBe(
            'PAID',
         );
         expect(afterValidPayment.paidAmount, `Paid amount should equal total after valid payment.`).toBe(
            totalAmount,
         );

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
            await cancelOrder(request, auth, orderId, 'E2E payment-over-amount cleanup').catch(
               () => undefined,
            );
         }

         await resetPaymentOverAmountTable(request, auth, table).catch(() => undefined);
      }
   });
});