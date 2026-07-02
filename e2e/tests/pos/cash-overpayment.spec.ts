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

const CASH_OVERPAYMENT_TABLE = {
   name: 'E2E Cash Overpayment',
   qrIdentifier: 'e2e-cash-overpayment',
} as const;

const CHANGE_AMOUNT = 900;

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

interface ReceiptPaymentLike {
   amount?: number;
   tenderedAmount?: number;
   changeAmount?: number;
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

function receiptPaidAmount(receipt: ReceiptLike): number | undefined {
   if (typeof receipt.paidAmount === 'number') return receipt.paidAmount;

   const payments = receipt.payments ?? [];
   if (payments.length === 0) return undefined;

   return payments.reduce((sum, payment) => sum + (payment.amount ?? 0), 0);
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
   tenderedAmount: number,
): Promise<RecordPaymentResponse> {
   const response = await requestText(
      request,
      'post',
      `${ENV.apiBaseUrl}/orders/${encodeURIComponent(orderId)}/payments`,
      {
         headers: auth,
         data: { method: 'CASH', amount, tenderedAmount },
      },
   );

   if (!response.ok) {
      throw new Error(
         `POST /orders/${orderId}/payments failed: ${response.status} ${response.text}`,
      );
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

async function ensureCashOverpaymentTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
): Promise<TableResponse> {
   const existing = (await listTables(request, auth)).find(
      (table) =>
         table.qrIdentifier === CASH_OVERPAYMENT_TABLE.qrIdentifier ||
         table.name === CASH_OVERPAYMENT_TABLE.name,
   );

   if (existing) return existing;

   const floors = await listFloors(request, auth);
   const floor = floors.find((candidate) => candidate.status === 'ACTIVE') ?? floors[0];

   if (!floor) {
      throw new Error('Cannot create cash-overpayment E2E table: GET /floors returned no floors.');
   }

   return createTable(request, auth, {
      floorId: floor.id,
      name: CASH_OVERPAYMENT_TABLE.name,
      seatCapacity: 4,
      qrIdentifier: CASH_OVERPAYMENT_TABLE.qrIdentifier,
   });
}

async function resetCashOverpaymentTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   table: TableResponse,
): Promise<TableResponse> {
   const activeOrders = await listActiveOrdersForTable(request, auth, table.id);

   for (const order of activeOrders) {
      await cancelOrder(request, auth, order.id, 'E2E cash-overpayment setup cleanup').catch(
         () => undefined,
      );
   }

   const remainingOrders = await listActiveOrdersForTable(request, auth, table.id);
   expect(
      remainingOrders,
      [
         'Cash-overpayment setup could not clear active orders.',
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

   expect(served.status, `Prepared cash-overpayment order ${created.id} should be SERVED.`).toBe(
      'SERVED',
   );
   expect(served.tableId, `Prepared order ${created.id} should stay on cash-overpayment table.`).toBe(
      table.id,
   );
   expect(served.paymentStatus, `Prepared order ${created.id} should start unpaid.`).toBe('UNPAID');
   expect(served.totals?.totalAmount, `Prepared order ${created.id} should have total.`).toBeGreaterThan(
      0,
   );

   return served;
}

test.describe('POS cash overpayment', () => {
   test('calculates change for cash tendered above the order total and closes paid order', async ({
      request,
   }) => {
      const fixture = readFixtures() as CustomerOrderRequestFixture;

      await expectApiHealth(request, { label: 'primary API for cash-overpayment test' });

      const auth = await seededOwnerAuthHeaders(request, fixture);
      const table = await resetCashOverpaymentTable(
         request,
         auth,
         await ensureCashOverpaymentTable(request, auth),
      );

      let orderId: string | undefined;

      try {
         const order = await createServedOrder(request, auth, table, fixture);
         orderId = order.id;

         const totalAmount = order.totals?.totalAmount;
         expect(totalAmount, `Order ${order.id} should have a positive total.`).toBeGreaterThan(0);

         const tenderedAmount = (totalAmount ?? 0) + CHANGE_AMOUNT;

         const tableAfterCreate = await getTable(request, auth, table.id);
         expect(tableAfterCreate.status, `Table ${table.id} should be occupied after dine-in order.`).toBe(
            'OCCUPIED',
         );

         const paymentResult = await recordCashPayment(
            request,
            auth,
            order.id,
            totalAmount ?? 0,
            tenderedAmount,
         );

         expect(paymentResult.payment.method, 'Payment method should be CASH.').toBe('CASH');
         expect(paymentResult.payment.amount, 'Applied payment amount should equal order total.').toBe(
            totalAmount,
         );
         expect(
            paymentResult.payment.tenderedAmount,
            'Tendered cash amount should preserve cash received from customer.',
         ).toBe(tenderedAmount);
         expect(paymentResult.changeAmount, 'Change amount should equal tendered - total.').toBe(
            CHANGE_AMOUNT,
         );

         const afterPayment = await getOrder(request, auth, order.id);
         expect(afterPayment.status, `Payment should not close order ${order.id} automatically.`).toBe(
            'SERVED',
         );
         expect(afterPayment.paymentStatus, `Order ${order.id} should be PAID after full cash payment.`).toBe(
            'PAID',
         );
         expect(afterPayment.paidAmount, `Paid amount should equal order total.`).toBe(totalAmount);
         expect(afterPayment.totals?.totalAmount, `Payment should not change order total.`).toBe(
            totalAmount,
         );

         const payments = activePayments(afterPayment);
         expect(payments, `Order ${order.id} should have one active cash payment.`).toHaveLength(1);
         expect(payments[0].method, 'Active payment method should be CASH.').toBe('CASH');
         expect(payments[0].amount, 'Active payment amount should equal order total.').toBe(totalAmount);
         expect(
            payments[0].tenderedAmount,
            'Active payment tenderedAmount should equal cash received.',
         ).toBe(tenderedAmount);

         const receiptBeforeClose = (await getReceipt(request, auth, order.id)) as ReceiptLike;
         expect(receiptBeforeClose.paymentStatus, 'Receipt should show PAID after full payment.').toBe(
            'PAID',
         );
         expect(receiptBeforeClose.totalAmount, 'Receipt total should equal order total.').toBe(
            totalAmount,
         );
         expect(
            receiptPaidAmount(receiptBeforeClose),
            'Receipt paid amount should equal order total, either from top-level paidAmount or summed payments.',
         ).toBe(totalAmount);
         expect(receiptBeforeClose.closedAt, 'Receipt should not be closed before close endpoint.').toBeNull();
         expect(receiptBeforeClose.payments, 'Receipt should include one cash payment.').toHaveLength(1);
         expect(receiptBeforeClose.payments?.[0]?.amount, 'Receipt payment amount should equal total.').toBe(
            totalAmount,
         );
         expect(
            receiptBeforeClose.payments?.[0]?.tenderedAmount,
            'Receipt payment should preserve tendered cash.',
         ).toBe(tenderedAmount);

         const closed = await closeOrder(request, auth, order.id);
         expect(closed.status, `Fully paid cash-overpayment order ${order.id} should close.`).toBe(
            'CLOSED',
         );
         expect(closed.paymentStatus, `Closed order ${order.id} should stay PAID.`).toBe('PAID');
         expect(closed.paidAmount, `Closed order paid amount should equal order total.`).toBe(
            totalAmount,
         );

         const receiptAfterClose = (await getReceipt(request, auth, order.id)) as ReceiptLike;
         expect(receiptAfterClose.paymentStatus, 'Closed receipt should show PAID.').toBe('PAID');
         expect(receiptAfterClose.totalAmount, 'Closed receipt total should equal order total.').toBe(
            totalAmount,
         );
         expect(
            receiptPaidAmount(receiptAfterClose),
            'Closed receipt paid amount should equal order total, either from top-level paidAmount or summed payments.',
         ).toBe(totalAmount);
         expect(receiptAfterClose.closedAt, 'Closed receipt should have closedAt.').toBeTruthy();
         expect(receiptAfterClose.payments, 'Closed receipt should include one cash payment.').toHaveLength(
            1,
         );
         expect(receiptAfterClose.payments?.[0]?.amount, 'Closed receipt payment amount should equal total.').toBe(
            totalAmount,
         );
         expect(
            receiptAfterClose.payments?.[0]?.tenderedAmount,
            'Closed receipt should preserve tendered cash.',
         ).toBe(tenderedAmount);

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
            await cancelOrder(request, auth, orderId, 'E2E cash-overpayment cleanup').catch(
               () => undefined,
            );
         }

         await resetCashOverpaymentTable(request, auth, table).catch(() => undefined);
      }
   });
});