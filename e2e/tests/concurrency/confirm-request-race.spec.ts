import { expect, test, type APIRequestContext } from '@playwright/test';
import { ENV } from '../../config/env';
import { expectApiHealth } from '../../helpers/health';
import {
  cancelOrder,
  changeTableStatus,
  createPendingCustomerOrderRequest,
  getOrder,
  getPublicOrderRequest,
  getTable,
  listActiveOrdersForTable,
  listPendingOrderRequests,
  parseJsonBody,
  posAuthHeaders,
  requireCustomerOrderRequestFixture,
  responseBodyText,
  seededOwnerAuthHeaders,
  type CustomerOrderRequestFixture,
  type OrderResponse,
  type PosAuthHeaders,
  type StaffOrderRequestResponse,
  type TableResponse,
} from '../../helpers/order-requests';
import { buildPosSession, readFixtures } from '../../helpers/session';

const HANDOFF = 30_000;
const SAFE_DUPLICATE_CONFIRM_STATUSES = [400, 404, 409];

interface ConfirmAttempt {
  label: string;
  status: number;
  ok: boolean;
  text: string;
  order?: OrderResponse;
}

async function rejectOrderRequest(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  requestId: string,
  reason: string,
): Promise<StaffOrderRequestResponse | null> {
  const response = await request.post(
    `${ENV.apiBaseUrl}/order-requests/${encodeURIComponent(requestId)}/reject`,
    {
      headers: auth,
      data: { reason },
      failOnStatusCode: false,
      ignoreHTTPSErrors: true,
    },
  );
  const text = await responseBodyText(response);
  if (!response.ok()) return null;
  return parseJsonBody<StaffOrderRequestResponse>(
    text,
    `POST /order-requests/${requestId}/reject`,
  );
}

async function confirmOrderRequestRaw(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  requestId: string,
  label: string,
): Promise<ConfirmAttempt> {
  const response = await request.post(
    `${ENV.apiBaseUrl}/order-requests/${encodeURIComponent(requestId)}/confirm`,
    {
      headers: auth,
      failOnStatusCode: false,
      ignoreHTTPSErrors: true,
    },
  );
  const text = await responseBodyText(response);
  const attempt: ConfirmAttempt = {
    label,
    status: response.status(),
    ok: response.ok(),
    text,
  };

  if (response.ok()) {
    attempt.order = parseJsonBody<OrderResponse>(
      text,
      `${label} POST /order-requests/${requestId}/confirm`,
    );
    expect(
      attempt.order.id,
      `${label} confirm response did not include an order id: ${text}`,
    ).toBeTruthy();
  }

  return attempt;
}

async function resetSeededTableState(
  request: APIRequestContext,
  fixture: CustomerOrderRequestFixture,
  posAuth: PosAuthHeaders,
  ownerAuth: PosAuthHeaders,
  reason: string,
): Promise<TableResponse> {
  const required = requireCustomerOrderRequestFixture(fixture);
  const pending = await listPendingOrderRequests(request, posAuth);
  for (const orderRequest of pending.filter((item) => item.tableId === required.tableId)) {
    await rejectOrderRequest(request, posAuth, orderRequest.id, reason).catch(() => undefined);
  }

  const activeOrders = await listActiveOrdersForTable(request, ownerAuth, required.tableId);
  for (const order of activeOrders) {
    await cancelOrder(request, ownerAuth, order.id, reason).catch(() => undefined);
  }

  const remainingActive = await listActiveOrdersForTable(request, ownerAuth, required.tableId);
  expect(
    remainingActive,
    [
      'Could not clear active orders for seeded table before confirm-request race test.',
      `table id/name: ${required.tableId} / ${required.tableName}`,
      `remaining order ids/statuses: ${remainingActive.map((order) => `${order.id}:${order.status ?? '<unknown>'}`).join(', ') || '<none>'}`,
    ].join('\n'),
  ).toHaveLength(0);

  const table = await getTable(request, ownerAuth, required.tableId);
  if (table.status !== 'AVAILABLE') {
    return changeTableStatus(request, ownerAuth, required.tableId, 'AVAILABLE');
  }
  return table;
}

async function cleanupAfterTest(
  request: APIRequestContext,
  fixture: CustomerOrderRequestFixture,
  posAuth: PosAuthHeaders,
  ownerAuth: PosAuthHeaders,
): Promise<void> {
  const required = requireCustomerOrderRequestFixture(fixture);
  const pending = await listPendingOrderRequests(request, posAuth).catch(() => []);
  for (const orderRequest of pending.filter((item) => item.tableId === required.tableId)) {
    await rejectOrderRequest(
      request,
      posAuth,
      orderRequest.id,
      'E2E confirm-request race cleanup',
    ).catch(() => undefined);
  }

  const activeOrders = await listActiveOrdersForTable(request, ownerAuth, required.tableId).catch(
    () => [],
  );
  for (const order of activeOrders) {
    await cancelOrder(request, ownerAuth, order.id, 'E2E confirm-request race cleanup').catch(
      () => undefined,
    );
  }

  const table = await getTable(request, ownerAuth, required.tableId).catch(() => null);
  if (table && table.status !== 'AVAILABLE') {
    await changeTableStatus(request, ownerAuth, required.tableId, 'AVAILABLE').catch(() => undefined);
  }
}

function formatAttempts(attempts: ConfirmAttempt[]): string {
  return attempts
    .map(
      (attempt) =>
        `${attempt.label}: ${attempt.status} ${attempt.ok ? 'ok' : 'failed'} order=${attempt.order?.id ?? '<none>'} body=${attempt.text}`,
    )
    .join('\n');
}

test.describe('concurrent POS request confirmation', () => {
  test('confirms one pending customer request safely under duplicate POS submits', async ({
    request,
  }) => {
    const fixture = readFixtures() as CustomerOrderRequestFixture;
    const required = requireCustomerOrderRequestFixture(fixture);

    await expectApiHealth(request, { label: 'primary API for confirm-request race' });
    const posSession = await buildPosSession();
    const posAuth = posAuthHeaders(posSession);
    const ownerAuth = await seededOwnerAuthHeaders(request, fixture);

    try {
      const setupTable = await resetSeededTableState(
        request,
        fixture,
        posAuth,
        ownerAuth,
        'E2E confirm-request race setup cleanup',
      );
      expect(setupTable.status, 'Seeded customer table should start AVAILABLE after cleanup.').toBe(
        'AVAILABLE',
      );

      const created = await createPendingCustomerOrderRequest(request, fixture);
      const publicBefore = await getPublicOrderRequest(request, fixture, created.id);
      expect(publicBefore.status, `Created request ${created.id} was not PENDING.`).toBe(
        'PENDING',
      );

      const pendingBefore = await listPendingOrderRequests(request, posAuth);
      const pendingForTableBefore = pendingBefore.filter((item) => item.tableId === required.tableId);
      expect(
        pendingForTableBefore.map((orderRequest) => orderRequest.id),
        [
          `POS pending API should contain exactly the created request for table ${required.tableId}.`,
          `created request id: ${created.id}`,
          `pending ids for table: ${pendingForTableBefore.map((orderRequest) => orderRequest.id).join(', ') || '<none>'}`,
        ].join('\n'),
      ).toEqual([created.id]);

      const activeBefore = await listActiveOrdersForTable(request, ownerAuth, required.tableId);
      expect(
        activeBefore,
        `Seeded table ${required.tableId} should not have an active order before confirmation.`,
      ).toHaveLength(0);

      const settled = await Promise.allSettled([
        confirmOrderRequestRaw(request, posAuth, created.id, 'confirm A'),
        confirmOrderRequestRaw(request, posAuth, created.id, 'confirm B'),
      ]);

      const rejected = settled.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );
      expect(
        rejected,
        `Raw concurrent confirm calls should return HTTP responses instead of throwing: ${rejected.map((result) => String(result.reason)).join('\n')}`,
      ).toHaveLength(0);

      const attempts = settled.map((result) => (result as PromiseFulfilledResult<ConfirmAttempt>).value);
      expect(
        attempts.filter((attempt) => attempt.status >= 500),
        [
          'Backend race handling bug: duplicate confirm returned a 5xx response.',
          `request id: ${created.id}`,
          formatAttempts(attempts),
        ].join('\n'),
      ).toHaveLength(0);

      const successful = attempts.filter((attempt) => attempt.ok);
      expect(
        successful.length,
        [
          'At least one concurrent confirm should succeed.',
          `request id: ${created.id}`,
          formatAttempts(attempts),
        ].join('\n'),
      ).toBeGreaterThanOrEqual(1);

      const failed = attempts.filter((attempt) => !attempt.ok);
      for (const attempt of failed) {
        expect(
          SAFE_DUPLICATE_CONFIRM_STATUSES,
          [
            `${attempt.label} should fail safely with 400/409/404 when racing the same request.`,
            `request id: ${created.id}`,
            formatAttempts(attempts),
          ].join('\n'),
        ).toContain(attempt.status);
      }

      if (successful.length > 1) {
        expect(
          new Set(successful.map((attempt) => attempt.order?.id)).size,
          [
            'Duplicate confirm may be idempotent only if all successful responses point to the same order.',
            `request id: ${created.id}`,
            formatAttempts(attempts),
          ].join('\n'),
        ).toBe(1);
      }

      await expect
        .poll(
          async () =>
            (await listActiveOrdersForTable(request, ownerAuth, required.tableId)).map(
              (order) => order.id,
            ),
          {
            timeout: HANDOFF,
            message: [
              'Product bug: concurrent confirmation created duplicate active orders or no active order.',
              `table id/name: ${required.tableId} / ${required.tableName}`,
              `request id: ${created.id}`,
              formatAttempts(attempts),
            ].join('\n'),
          },
        )
        .toHaveLength(1);

      const activeAfter = await listActiveOrdersForTable(request, ownerAuth, required.tableId);
      const activeOrder = await getOrder(request, ownerAuth, activeAfter[0].id);
      expect(activeOrder.tableId, `Confirmed order should be assigned to seeded table.`).toBe(
        required.tableId,
      );
      expect(
        activeOrder.items?.some((item) => item.menuItemId === required.dishId),
        [
          'Confirmed order should contain the requested seeded dish.',
          `order id: ${activeOrder.id}`,
          `dish id: ${required.dishId}`,
          `items: ${JSON.stringify(activeOrder.items ?? [])}`,
        ].join('\n'),
      ).toBeTruthy();

      const activeOrdersWithRequestedItem = await Promise.all(
        activeAfter.map((order) => getOrder(request, ownerAuth, order.id)),
      );
      expect(
        activeOrdersWithRequestedItem.filter((order) =>
          order.items?.some((item) => item.menuItemId === required.dishId),
        ),
        [
          'Product bug: more than one active order contains the requested item after duplicate confirm.',
          `table id/name: ${required.tableId} / ${required.tableName}`,
          `request id: ${created.id}`,
          `active order ids: ${activeAfter.map((order) => order.id).join(', ') || '<none>'}`,
          formatAttempts(attempts),
        ].join('\n'),
      ).toHaveLength(1);

      const publicAfter = await getPublicOrderRequest(request, fixture, created.id);
      expect(publicAfter.status, `Original request ${created.id} should no longer be PENDING.`).not.toBe(
        'PENDING',
      );

      const pendingAfter = await listPendingOrderRequests(request, posAuth);
      expect(
        pendingAfter.some((orderRequest) => orderRequest.id === created.id),
        [
          `Confirmed request ${created.id} should not remain in POS pending API list.`,
          `pending ids: ${pendingAfter.map((orderRequest) => orderRequest.id).join(', ') || '<none>'}`,
        ].join('\n'),
      ).toBeFalsy();

      const tableAfter = await getTable(request, ownerAuth, required.tableId);
      expect(tableAfter.status, `Seeded table should be OCCUPIED after confirmation.`).toBe(
        'OCCUPIED',
      );
    } finally {
      await cleanupAfterTest(request, fixture, posAuth, ownerAuth);
    }
  });
});
