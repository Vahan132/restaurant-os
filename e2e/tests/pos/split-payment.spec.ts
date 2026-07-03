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

const SPLIT_PAYMENT_TABLE = {
   name: 'E2E Split Payment',
   qrIdentifier: 'e2e-split-payment',
} as const;

const FIRST_PAYMENT_AMOUNT = 2000;
const SECOND_PAYMENT_METHOD = 'CARD';

interface RequestResult {
   status: number;
   ok: boolean;
   text: string;
}

interface RecordPaymentResponse {
   payment: PaymentResponse;
   changeAmount: number;
   order: OrderResponse;
}

type PaymentMethod = 'CASH' | 'CARD';

function activePayments(order: OrderResponse): PaymentResponse[] {
   return (order.payments ?? []).filter((payment) => payment.state === 'ACTIVE');
}

function receiptPaymentTotal(payments: Array<{ amount: number }>): number {
   return payments.reduce((sum, payment) => sum + payment.amount, 0);
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

async function recordPayment(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   orderId: string,
   input: { method: PaymentMethod; amount: number; tenderedAmount?: number },
): Promise<RecordPaymentResponse> {
   const response = await requestText(
      request,
      'post',
      `${ENV.apiBaseUrl}/orders/${encodeURIComponent(orderId)}/payments`,
      {
         headers: auth,
         data: input,
      },
   );

   if (!response.ok) {
      throw new Error(`POST /orders/${orderId}/payments failed: ${response.status} ${response.text}`);
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

async function ensureSplitPaymentTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
): Promise<TableResponse> {
   const existing = (await listTables(request, auth)).find(
      (table) =>
         table.qrIdentifier === SPLIT_PAYMENT_TABLE.qrIdentifier ||
         table.name === SPLIT_PAYMENT_TABLE.name,
   );

   if (existing) return existing;

   const floors = await listFloors(request, auth);
   const floor = floors.find((candidate) => candidate.status === 'ACTIVE') ?? floors[0];

   if (!floor) {
      throw new Error('Cannot create split-payment E2E table: GET /floors returned no floors.');
   }

   return createTable(request, auth, {
      floorId: floor.id,
      name: SPLIT_PAYMENT_TABLE.name,
      seatCapacity: 4,
      qrIdentifier: SPLIT_PAYMENT_TABLE.qrIdentifier,
   });
}

async function resetSplitPaymentTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   table: TableResponse,
): Promise<TableResponse> {
   const activeOrders = await listActiveOrdersForTable(request, auth, table.id);

   for (const order of activeOrders) {
      await cancelOrder(request, auth, order.id, 'E2E split-payment setup cleanup').catch(
         () => undefined,
      );
   }

   const remainingOrders = await listActiveOrdersForTable(request, auth, table.id);
   expect(
      remainingOrders,
      [
         'Split-payment setup could not clear active orders.',
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

   expect(served.status, `Prepared split-payment order ${created.id} should be SERVED.`).toBe(
      'SERVED',
   );
   expect(served.tableId, `Prepared order ${created.id} should stay on split-payment table.`).toBe(
      table.id,
   );
   expect(served.paymentStatus, `Prepared order ${created.id} should start unpaid.`).toBe('UNPAID');
   expect(served.paidAmount, `Prepared order ${created.id} should start with no paid amount.`).toBe(0);
   expect(
      served.totals?.totalAmount,
      `Prepared order ${created.id} total should be higher than first split payment.`,
   ).toBeGreaterThan(FIRST_PAYMENT_AMOUNT);

   return served;
}

test.describe('POS split payment', () => {
   test('records multiple payments before closing a dine-in order', async ({ request }) => {
      const fixture = readFixtures() as CustomerOrderRequestFixture;

      await expectApiHealth(request, { label: 'primary API for split-payment test' });

      const auth = await seededOwnerAuthHeaders(request, fixture);
      const table = await resetSplitPaymentTable(
         request,
         auth,
         await ensureSplitPaymentTable(request, auth),
      );

      let orderId: string | undefined;

      try {
         const order = await createServedOrder(request, auth, table, fixture);
         orderId = order.id;

         const totalAmount = order.totals?.totalAmount;
         expect(totalAmount, `Order ${order.id} should have a total.`).toBeGreaterThan(
            FIRST_PAYMENT_AMOUNT,
         );

         const tableAfterCreate = await getTable(request, auth, table.id);
         expect(tableAfterCreate.status, `Table ${table.id} should be occupied after dine-in order.`).toBe(
            'OCCUPIED',
         );

         const firstPayment = await recordPayment(request, auth, order.id, {
            method: 'CASH',
            amount: FIRST_PAYMENT_AMOUNT,
            tenderedAmount: FIRST_PAYMENT_AMOUNT,
         });
         expect(firstPayment.payment.method, 'First split payment method should be CASH.').toBe('CASH');
         expect(firstPayment.payment.amount, 'First split payment amount should match input.').toBe(
            FIRST_PAYMENT_AMOUNT,
         );
         expect(
            firstPayment.payment.tenderedAmount,
            'First split payment tendered amount should match input.',
         ).toBe(FIRST_PAYMENT_AMOUNT);
         expect(firstPayment.payment.state, 'First split payment should be active.').toBe('ACTIVE');

         const afterFirstPayment = await getOrder(request, auth, order.id);
         expect(afterFirstPayment.status, `First payment should not close order ${order.id}.`).toBe(
            'SERVED',
         );
         expect(
            afterFirstPayment.paymentStatus,
            `First payment should not mark order ${order.id} PAID.`,
         ).not.toBe('PAID');
         expect(
            afterFirstPayment.paidAmount,
            `Order ${order.id} paidAmount should equal first split payment.`,
         ).toBe(FIRST_PAYMENT_AMOUNT);
         expect(afterFirstPayment.totals?.totalAmount, `First payment must not change order total.`).toBe(
            totalAmount,
         );

         const activeAfterFirst = activePayments(afterFirstPayment);
         expect(activeAfterFirst, `Order ${order.id} should have one active payment after first split.`).toHaveLength(
            1,
         );
         expect(activeAfterFirst[0].id, 'Active payment should be the first split payment.').toBe(
            firstPayment.payment.id,
         );

         const tableAfterFirstPayment = await getTable(request, auth, table.id);
         expect(
            tableAfterFirstPayment.status,
            `Partially paid table ${table.id} should stay OCCUPIED.`,
         ).toBe('OCCUPIED');

         const receiptAfterFirst = await getReceipt(request, auth, order.id);
         expect(
            receiptAfterFirst.paymentStatus,
            'Receipt should not show PAID after first split payment.',
         ).not.toBe('PAID');
         expect(receiptAfterFirst.totalAmount, 'Receipt total should match order total.').toBe(
            totalAmount,
         );
         expect(receiptAfterFirst.payments, 'Receipt should include one active payment.').toHaveLength(1);
         expect(receiptAfterFirst.payments[0].method, 'Receipt first payment should be CASH.').toBe(
            'CASH',
         );
         expect(receiptAfterFirst.payments[0].amount, 'Receipt first payment should match input.').toBe(
            FIRST_PAYMENT_AMOUNT,
         );
         expect(receiptAfterFirst.closedAt, 'Receipt should not have closedAt before close.').toBeNull();

         const remainingAmount = (totalAmount ?? 0) - FIRST_PAYMENT_AMOUNT;
         expect(remainingAmount, 'Remaining split-payment amount should be positive.').toBeGreaterThan(0);

         const secondPayment = await recordPayment(request, auth, order.id, {
            method: SECOND_PAYMENT_METHOD,
            amount: remainingAmount,
            tenderedAmount: remainingAmount,
         });
         expect(secondPayment.payment.method, 'Second split payment method should be CARD.').toBe(
            SECOND_PAYMENT_METHOD,
         );
         expect(secondPayment.payment.amount, 'Second split payment should equal remaining balance.').toBe(
            remainingAmount,
         );
         expect(
            secondPayment.payment.tenderedAmount,
            'Second split payment tendered amount should match input.',
         ).toBe(remainingAmount);
         expect(secondPayment.payment.state, 'Second split payment should be active.').toBe('ACTIVE');

         const afterSecondPayment = await getOrder(request, auth, order.id);
         expect(afterSecondPayment.status, `Second payment should not close order ${order.id}.`).toBe(
            'SERVED',
         );
         expect(afterSecondPayment.paymentStatus, `Order ${order.id} should now be PAID.`).toBe('PAID');
         expect(
            afterSecondPayment.paidAmount,
            `Full split payment should bring paidAmount to total for order ${order.id}.`,
         ).toBe(totalAmount);
         expect(afterSecondPayment.totals?.totalAmount, `Split payments must not change order total.`).toBe(
            totalAmount,
         );

         const activeAfterSecond = activePayments(afterSecondPayment);
         expect(activeAfterSecond, `Order ${order.id} should have two active payments.`).toHaveLength(2);
         expect(
            activeAfterSecond.map((payment) => payment.amount).sort((a, b) => a - b),
            'Active payment amounts should match the split.',
         ).toEqual([FIRST_PAYMENT_AMOUNT, remainingAmount].sort((a, b) => a - b));

         const receiptAfterSecond = await getReceipt(request, auth, order.id);
         expect(receiptAfterSecond.paymentStatus, 'Receipt should show PAID after full split payment.').toBe(
            'PAID',
         );
         expect(receiptAfterSecond.totalAmount, 'Receipt total should stay unchanged.').toBe(totalAmount);
         expect(receiptAfterSecond.payments, 'Receipt should include both active payments.').toHaveLength(2);
         expect(
            receiptPaymentTotal(receiptAfterSecond.payments),
            'Receipt split payment amounts should sum to total.',
         ).toBe(totalAmount);
         expect(
            receiptAfterSecond.payments.map((payment) => payment.method),
            'Receipt should preserve both payment methods.',
         ).toEqual(['CASH', SECOND_PAYMENT_METHOD]);
         expect(receiptAfterSecond.closedAt, 'Receipt should not have closedAt before close.').toBeNull();

         const closed = await closeOrderOk(request, auth, order.id);
         expect(closed.status, `Fully paid split-payment order ${order.id} should close.`).toBe(
            'CLOSED',
         );
         expect(closed.paymentStatus, `Closed split-payment order ${order.id} should stay PAID.`).toBe(
            'PAID',
         );

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
               await cancelOrder(request, auth, order.id, 'E2E split-payment cleanup').catch(
                  () => undefined,
               );
            }
         }

         await resetSplitPaymentTable(request, auth, table).catch(() => undefined);
      }
   });
});
