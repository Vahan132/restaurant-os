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

const CLOSE_ORDER_RACE_TABLE = {
  name: 'E2E Close Order Race',
  qrIdentifier: 'e2e-close-order-race',
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

interface CloseAttempt extends RequestResult {
  label: string;
  order?: OrderResponse;
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

async function recordCashPaymentOk(
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
  label: string,
): Promise<CloseAttempt> {
  const response = await requestText(
    request,
    'post',
    `${ENV.apiBaseUrl}/orders/${encodeURIComponent(orderId)}/close`,
    { headers: auth },
  );
  const attempt: CloseAttempt = { label, ...response };

  if (response.ok) {
    attempt.order = parseJsonBody<OrderResponse>(
      response.text,
      `${label} POST /orders/${orderId}/close`,
    );
    expect(attempt.order.id, `${label} close response returned wrong order.`).toBe(orderId);
  }

  return attempt;
}

async function ensureCloseOrderRaceTable(
  request: APIRequestContext,
  auth: PosAuthHeaders,
): Promise<TableResponse> {
  const existing = (await listTables(request, auth)).find(
    (table) =>
      table.qrIdentifier === CLOSE_ORDER_RACE_TABLE.qrIdentifier ||
      table.name === CLOSE_ORDER_RACE_TABLE.name,
  );

  if (existing) return existing;

  const floors = await listFloors(request, auth);
  const floor = floors.find((candidate) => candidate.status === 'ACTIVE') ?? floors[0];

  if (!floor) {
    throw new Error('Cannot create close-order-race E2E table: GET /floors returned no floors.');
  }

  return createTable(request, auth, {
    floorId: floor.id,
    name: CLOSE_ORDER_RACE_TABLE.name,
    seatCapacity: 4,
    qrIdentifier: CLOSE_ORDER_RACE_TABLE.qrIdentifier,
  });
}

async function resetCloseOrderRaceTable(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  table: TableResponse,
): Promise<TableResponse> {
  const activeOrders = await listActiveOrdersForTable(request, auth, table.id);

  for (const order of activeOrders) {
    await cancelOrder(request, auth, order.id, 'E2E close-order-race setup cleanup').catch(
      () => undefined,
    );
  }

  const remainingOrders = await listActiveOrdersForTable(request, auth, table.id);
  expect(
    remainingOrders,
    [
      'Close-order-race setup could not clear active orders.',
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

  expect(served.status, `Prepared close-order-race order ${created.id} should be SERVED.`).toBe(
    'SERVED',
  );
  expect(served.tableId, `Prepared order ${created.id} should stay on close-order-race table.`).toBe(
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

function formatAttempts(attempts: CloseAttempt[]): string {
  return attempts
    .map(
      (attempt) =>
        `${attempt.label}: ${attempt.status} ${attempt.ok ? 'ok' : 'failed'} orderStatus=${attempt.order?.status ?? '<none>'} body=${attempt.text}`,
    )
    .join('\n');
}

test.describe('concurrent POS order close', () => {
  test('closes one fully paid order safely under duplicate POS submits', async ({ request }) => {
    const fixture = readFixtures() as CustomerOrderRequestFixture;

    await expectApiHealth(request, { label: 'primary API for close-order-race test' });

    const auth = await seededOwnerAuthHeaders(request, fixture);
    const table = await resetCloseOrderRaceTable(
      request,
      auth,
      await ensureCloseOrderRaceTable(request, auth),
    );

    let orderId: string | undefined;

    try {
      expect(table.status, `Close-order-race table ${table.id} should start AVAILABLE.`).toBe(
        'AVAILABLE',
      );

      const order = await createServedOrder(request, auth, table, fixture);
      orderId = order.id;

      const totalAmount = order.totals?.totalAmount;
      expect(totalAmount, `Order ${order.id} should have a positive total.`).toBeGreaterThan(0);

      const payment = await recordCashPaymentOk(request, auth, order.id, totalAmount ?? 0);
      expect(payment.payment.method, 'Full payment method should be CASH.').toBe('CASH');
      expect(payment.payment.amount, 'Full payment should equal order total.').toBe(totalAmount);
      expect(payment.payment.tenderedAmount, 'Full tendered amount should equal order total.').toBe(
        totalAmount,
      );
      expect(payment.payment.state, 'Full payment should be active.').toBe('ACTIVE');

      const beforeClose = await getOrder(request, auth, order.id);
      expect(beforeClose.status, `Paid order ${order.id} should be SERVED before close.`).toBe(
        'SERVED',
      );
      expect(beforeClose.paymentStatus, `Order ${order.id} should be PAID before close.`).toBe(
        'PAID',
      );
      expect(beforeClose.paidAmount, `Paid amount should equal total before close.`).toBe(
        totalAmount,
      );
      expect(activePayments(beforeClose), `Order ${order.id} should have one active payment.`).toHaveLength(
        1,
      );

      const tableBeforeClose = await getTable(request, auth, table.id);
      expect(tableBeforeClose.status, `Table ${table.id} should be OCCUPIED before close.`).toBe(
        'OCCUPIED',
      );

      const settled = await Promise.allSettled([
        closeOrderRaw(request, auth, order.id, 'close A'),
        closeOrderRaw(request, auth, order.id, 'close B'),
      ]);

      const rejected = settled.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );
      expect(
        rejected,
        `Raw concurrent close calls should return HTTP responses instead of throwing: ${rejected.map((result) => String(result.reason)).join('\n')}`,
      ).toHaveLength(0);

      const attempts = settled.map((result) => (result as PromiseFulfilledResult<CloseAttempt>).value);
      expect(
        attempts.filter((attempt) => attempt.status >= 500),
        [
          'Backend race handling bug: duplicate close returned a 5xx response.',
          `order id: ${order.id}`,
          formatAttempts(attempts),
        ].join('\n'),
      ).toHaveLength(0);

      const successful = attempts.filter((attempt) => attempt.ok);
      expect(
        successful.length,
        [
          'At least one concurrent close request should succeed.',
          `order id: ${order.id}`,
          formatAttempts(attempts),
        ].join('\n'),
      ).toBeGreaterThanOrEqual(1);

      const failed = attempts.filter((attempt) => !attempt.ok);
      for (const attempt of failed) {
        expect(
          attempt.status >= 400 && attempt.status < 500,
          [
            `${attempt.label} should fail safely with a client/conflict response when racing the same close.`,
            `order id: ${order.id}`,
            formatAttempts(attempts),
          ].join('\n'),
        ).toBeTruthy();
      }

      if (successful.length > 1) {
        expect(
          new Set(successful.map((attempt) => attempt.order?.id)).size,
          [
            'Duplicate close may be idempotent only if all successful responses point to the same order.',
            `order id: ${order.id}`,
            formatAttempts(attempts),
          ].join('\n'),
        ).toBe(1);
        expect(
          successful.every((attempt) => attempt.order?.status === 'CLOSED'),
          [
            'Idempotent duplicate close responses must all report CLOSED.',
            `order id: ${order.id}`,
            formatAttempts(attempts),
          ].join('\n'),
        ).toBeTruthy();
      }

      await expect
        .poll(
          async () => (await getOrder(request, auth, order.id)).status,
          {
            timeout: HANDOFF,
            message: [
              'Order close race bug: paid order did not settle to CLOSED after duplicate close.',
              `order id: ${order.id}`,
              formatAttempts(attempts),
            ].join('\n'),
          },
        )
        .toBe('CLOSED');

      const afterRace = await getOrder(request, auth, order.id);
      expect(afterRace.status, `Order ${order.id} should be CLOSED after close race.`).toBe(
        'CLOSED',
      );
      expect(afterRace.paymentStatus, `Closed order ${order.id} should stay PAID.`).toBe('PAID');
      expect(afterRace.paidAmount, `Closed order ${order.id} paidAmount should stay total.`).toBe(
        totalAmount,
      );
      expect(
        activePayments(afterRace),
        [
          'Product race-condition bug: duplicate close should not duplicate or void payments.',
          `order id: ${order.id}`,
          `payments: ${JSON.stringify(afterRace.payments ?? [])}`,
          formatAttempts(attempts),
        ].join('\n'),
      ).toHaveLength(1);

      const tableAfterRace = await getTable(request, auth, table.id);
      expect(
        tableAfterRace.status,
        [
          'Order/table state bug: table should be CLEANING after duplicate close race.',
          `table id/name: ${table.id} / ${table.name}`,
          `actual status: ${tableAfterRace.status}`,
          formatAttempts(attempts),
        ].join('\n'),
      ).toBe('CLEANING');

      const activeAfterRace = await listActiveOrdersForTable(request, auth, table.id);
      expect(
        activeAfterRace,
        [
          'Order/table state bug: table should have no active orders after duplicate close race.',
          `table id/name: ${table.id} / ${table.name}`,
          `active order ids: ${activeAfterRace.map((activeOrder) => activeOrder.id).join(', ') || '<none>'}`,
          formatAttempts(attempts),
        ].join('\n'),
      ).toHaveLength(0);

      const receiptAfterRace = await getReceipt(request, auth, order.id);
      expect(receiptAfterRace.paymentStatus, 'Receipt should show PAID after close race.').toBe(
        'PAID',
      );
      expect(receiptAfterRace.totalAmount, 'Receipt total should match order total.').toBe(totalAmount);
      expect(receiptAfterRace.payments, 'Receipt should still include one payment.').toHaveLength(1);
      expect(receiptAfterRace.payments[0].method, 'Receipt payment should be CASH.').toBe('CASH');
      expect(receiptAfterRace.payments[0].amount, 'Receipt payment should equal total.').toBe(
        totalAmount,
      );
      expect(receiptAfterRace.closedAt, 'Receipt should have exactly one closed timestamp field.').toBeTruthy();

      orderId = undefined;
    } finally {
      if (orderId) {
        const order = await getOrder(request, auth, orderId).catch(() => null);
        if (order?.status && !['CLOSED', 'CANCELLED'].includes(order.status)) {
          await cancelOrder(request, auth, order.id, 'E2E close-order-race cleanup').catch(
            () => undefined,
          );
        }
      }

      await resetCloseOrderRaceTable(request, auth, table).catch(() => undefined);
    }
  });
});
