import { expect, test, type APIRequestContext } from '@playwright/test';
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

const PAYMENT_RACE_TABLE = {
  name: 'E2E Payment Race',
  qrIdentifier: 'e2e-payment-race',
} as const;

const HANDOFF = 30_000;

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

interface PaymentAttempt extends RequestResult {
  label: string;
  record?: RecordPaymentResponse;
}

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

async function recordCashPaymentRaw(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  orderId: string,
  amount: number,
  label: string,
): Promise<PaymentAttempt> {
  const response = await requestText(
    request,
    'post',
    `${ENV.apiBaseUrl}/orders/${encodeURIComponent(orderId)}/payments`,
    {
      headers: auth,
      data: { method: 'CASH', amount, tenderedAmount: amount },
    },
  );
  const attempt: PaymentAttempt = { label, ...response };

  if (response.ok) {
    attempt.record = parseJsonBody<RecordPaymentResponse>(
      response.text,
      `${label} POST /orders/${orderId}/payments`,
    );
    expect(
      attempt.record.payment.id,
      `${label} payment response did not include a payment id: ${response.text}`,
    ).toBeTruthy();
    expect(attempt.record.order.id, `${label} payment response returned wrong order.`).toBe(orderId);
  }

  return attempt;
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

async function ensurePaymentRaceTable(
  request: APIRequestContext,
  auth: PosAuthHeaders,
): Promise<TableResponse> {
  const existing = (await listTables(request, auth)).find(
    (table) =>
      table.qrIdentifier === PAYMENT_RACE_TABLE.qrIdentifier ||
      table.name === PAYMENT_RACE_TABLE.name,
  );

  if (existing) return existing;

  const floors = await listFloors(request, auth);
  const floor = floors.find((candidate) => candidate.status === 'ACTIVE') ?? floors[0];

  if (!floor) {
    throw new Error('Cannot create payment-race E2E table: GET /floors returned no floors.');
  }

  return createTable(request, auth, {
    floorId: floor.id,
    name: PAYMENT_RACE_TABLE.name,
    seatCapacity: 4,
    qrIdentifier: PAYMENT_RACE_TABLE.qrIdentifier,
  });
}

async function resetPaymentRaceTable(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  table: TableResponse,
): Promise<TableResponse> {
  const activeOrders = await listActiveOrdersForTable(request, auth, table.id);

  for (const order of activeOrders) {
    await cancelOrder(request, auth, order.id, 'E2E payment-race setup cleanup').catch(
      () => undefined,
    );
  }

  const remainingOrders = await listActiveOrdersForTable(request, auth, table.id);
  expect(
    remainingOrders,
    [
      'Payment-race setup could not clear active orders.',
      `table id/name: ${table.id} / ${table.name}`,
      `remaining order ids/statuses: ${
        remainingOrders.map((order) => `${order.id}:${order.status ?? '<unknown>'}`).join(', ') ||
        '<none>'
      }`,
    ].join('\n'),
  ).toHaveLength(0);

  const current = await getTable(request, auth, table.id);
  if (current.status === 'AVAILABLE') return current;
  return changeTableStatus(request, auth, table.id, 'AVAILABLE');
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

  expect(served.status, `Prepared payment-race order ${created.id} should be SERVED.`).toBe(
    'SERVED',
  );
  expect(served.tableId, `Prepared order ${created.id} should stay on payment-race table.`).toBe(
    table.id,
  );
  expect(served.paymentStatus, `Prepared order ${created.id} should start unpaid.`).toBe('UNPAID');
  expect(served.paidAmount, `Prepared order ${created.id} should start with no paid amount.`).toBe(
    0,
  );
  expect(served.totals?.totalAmount, `Prepared order ${created.id} should have a total.`).toBeGreaterThan(
    0,
  );

  return served;
}

function formatAttempts(attempts: PaymentAttempt[]): string {
  return attempts
    .map(
      (attempt) =>
        `${attempt.label}: ${attempt.status} ${attempt.ok ? 'ok' : 'failed'} payment=${attempt.record?.payment.id ?? '<none>'} amount=${attempt.record?.payment.amount ?? '<none>'} body=${attempt.text}`,
    )
    .join('\n');
}

test.describe('concurrent POS payment recording', () => {
  test('records one full payment safely under duplicate POS submits', async ({ request }) => {
    const fixture = readFixtures() as CustomerOrderRequestFixture;

    await expectApiHealth(request, { label: 'primary API for payment-race test' });

    const auth = await seededOwnerAuthHeaders(request, fixture);
    const table = await resetPaymentRaceTable(
      request,
      auth,
      await ensurePaymentRaceTable(request, auth),
    );

    let orderId: string | undefined;

    try {
      expect(table.status, `Payment-race table ${table.id} should start AVAILABLE.`).toBe(
        'AVAILABLE',
      );

      const order = await createServedOrder(request, auth, table, fixture);
      orderId = order.id;

      const totalAmount = order.totals?.totalAmount;
      expect(totalAmount, `Order ${order.id} should have a positive total.`).toBeGreaterThan(0);

      const tableBeforePayment = await getTable(request, auth, table.id);
      expect(tableBeforePayment.status, `Table ${table.id} should be OCCUPIED before payment.`).toBe(
        'OCCUPIED',
      );

      const settled = await Promise.allSettled([
        recordCashPaymentRaw(request, auth, order.id, totalAmount ?? 0, 'payment A'),
        recordCashPaymentRaw(request, auth, order.id, totalAmount ?? 0, 'payment B'),
      ]);

      const rejected = settled.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );
      expect(
        rejected,
        `Raw concurrent payment calls should return HTTP responses instead of throwing: ${rejected.map((result) => String(result.reason)).join('\n')}`,
      ).toHaveLength(0);

      const attempts = settled.map((result) => (result as PromiseFulfilledResult<PaymentAttempt>).value);
      expect(
        attempts.filter((attempt) => attempt.status >= 500),
        [
          'Backend race handling bug: duplicate payment returned a 5xx response.',
          `order id: ${order.id}`,
          formatAttempts(attempts),
        ].join('\n'),
      ).toHaveLength(0);

      const successful = attempts.filter((attempt) => attempt.ok);
      expect(
        successful.length,
        [
          'At least one concurrent full-payment request should succeed.',
          `order id: ${order.id}`,
          formatAttempts(attempts),
        ].join('\n'),
      ).toBeGreaterThanOrEqual(1);

      const failed = attempts.filter((attempt) => !attempt.ok);
      for (const attempt of failed) {
        expect(
          attempt.status >= 400 && attempt.status < 500,
          [
            `${attempt.label} should fail safely with a client/conflict response when racing the same payment.`,
            `order id: ${order.id}`,
            formatAttempts(attempts),
          ].join('\n'),
        ).toBeTruthy();
      }

      if (successful.length > 1) {
        expect(
          new Set(successful.map((attempt) => attempt.record?.payment.id)).size,
          [
            'Duplicate payment may be idempotent only if all successful responses point to the same payment.',
            `order id: ${order.id}`,
            formatAttempts(attempts),
          ].join('\n'),
        ).toBe(1);
      }

      await expect
        .poll(
          async () => {
            const current = await getOrder(request, auth, order.id);
            return activePayments(current).length;
          },
          {
            timeout: HANDOFF,
            message: [
              'Product race-condition bug: concurrent full-payment created duplicate active payments or no active payment.',
              `order id: ${order.id}`,
              formatAttempts(attempts),
            ].join('\n'),
          },
        )
        .toBe(1);

      const afterRace = await getOrder(request, auth, order.id);
      expect(afterRace.status, `Paid order ${order.id} should remain SERVED before close.`).toBe(
        'SERVED',
      );
      expect(afterRace.paymentStatus, `Order ${order.id} should be PAID after one full payment.`).toBe(
        'PAID',
      );
      expect(
        afterRace.paidAmount,
        [
          'Money/race bug: paidAmount should equal total, not double total.',
          `order id: ${order.id}`,
          `total: ${totalAmount}`,
          `paidAmount: ${afterRace.paidAmount}`,
          formatAttempts(attempts),
        ].join('\n'),
      ).toBe(totalAmount);

      const activeAfterRace = activePayments(afterRace);
      expect(
        activeAfterRace,
        [
          'Product race-condition bug: order should have exactly one active payment after duplicate full-payment race.',
          `order id: ${order.id}`,
          `payments: ${JSON.stringify(afterRace.payments ?? [])}`,
          formatAttempts(attempts),
        ].join('\n'),
      ).toHaveLength(1);
      expect(activeAfterRace[0].method, 'The accepted payment should be CASH.').toBe('CASH');
      expect(activeAfterRace[0].amount, 'The accepted payment amount should equal total.').toBe(
        totalAmount,
      );
      expect(
        activeAfterRace[0].tenderedAmount,
        'The accepted payment tendered amount should equal total.',
      ).toBe(totalAmount);

      const receiptAfterRace = await getReceipt(request, auth, order.id);
      expect(receiptAfterRace.paymentStatus, 'Receipt should show PAID after full payment.').toBe(
        'PAID',
      );
      expect(receiptAfterRace.totalAmount, 'Receipt total should match order total.').toBe(totalAmount);
      expect(
        receiptAfterRace.payments,
        'Receipt should include exactly one active payment after duplicate full-payment race.',
      ).toHaveLength(1);
      expect(
        receiptPaymentTotal(receiptAfterRace.payments),
        [
          'Money/race bug: receipt payments should sum to total, not double total.',
          `order id: ${order.id}`,
          `total: ${totalAmount}`,
          `receipt payments: ${JSON.stringify(receiptAfterRace.payments)}`,
        ].join('\n'),
      ).toBe(totalAmount);
      expect(receiptAfterRace.closedAt, 'Receipt should not have closedAt before close.').toBeNull();

      const tableAfterPayment = await getTable(request, auth, table.id);
      expect(tableAfterPayment.status, `Paid but open table ${table.id} should stay OCCUPIED.`).toBe(
        'OCCUPIED',
      );

      const closed = await closeOrderOk(request, auth, order.id);
      expect(closed.status, `Fully paid payment-race order ${order.id} should close.`).toBe(
        'CLOSED',
      );
      expect(closed.paymentStatus, `Closed order ${order.id} should stay PAID.`).toBe('PAID');

      const tableAfterClose = await getTable(request, auth, table.id);
      expect(tableAfterClose.status, `Closed paid order should release table to CLEANING.`).toBe(
        'CLEANING',
      );

      const activeAfterClose = await listActiveOrdersForTable(request, auth, table.id);
      expect(
        activeAfterClose,
        `Table ${table.id} should have no active orders after close.`,
      ).toHaveLength(0);

      orderId = undefined;
    } finally {
      if (orderId) {
        const order = await getOrder(request, auth, orderId).catch(() => null);
        if (order?.status && !['CLOSED', 'CANCELLED'].includes(order.status)) {
          await cancelOrder(request, auth, order.id, 'E2E payment-race cleanup').catch(
            () => undefined,
          );
        }
      }

      await resetPaymentRaceTable(request, auth, table).catch(() => undefined);
    }
  });
});
