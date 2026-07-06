import { expect, test, type APIRequestContext, type Page, type Response } from '@playwright/test';
import { ENV, customerUrlFromFixture } from '../../config/env';
import { expectApiHealth, expectFrontendReachable } from '../../helpers/health';
import {
  addOrderItem,
  cancelOrder,
  changeTableStatus,
  confirmOrderRequest,
  createDineInOrder,
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
  sendOrderToKitchen,
  type CustomerOrderRequestFixture,
  type OrderResponse,
  type PosAuthHeaders,
  type StaffOrderRequestResponse,
  type TableResponse,
} from '../../helpers/order-requests';
import { buildPosSession, readFixtures } from '../../helpers/session';

const HANDOFF = 30_000;
const ACTIVE_ORDER_STATUSES = new Set(['DRAFT', 'SENT_TO_KITCHEN', 'PREPARING', 'READY', 'SERVED']);
const SEED_NOTE =
  'Run `pnpm db:seed` and then `pnpm db:seed:e2e` from the api workspace, then make sure e2e/fixtures/seeded.json is present on this machine.';

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
  code?: string;
  message?: string;
}

interface PublicOrderCreateResponse {
  id?: string;
  status?: string;
}

interface FailedResponse {
  url: string;
  status: number;
  statusText: string;
}

function publicHeaders(slug: string): Record<string, string> {
  return {
    'x-restaurant-slug': slug,
    'content-type': 'application/json',
  };
}

function errorCode(text: string): string | undefined {
  const body = parseJsonBody<ApiErrorBody>(text, 'API error response');
  return body.error?.code ?? body.code;
}

async function requestText(
  request: APIRequestContext,
  method: 'post',
  url: string,
  options: { headers?: Record<string, string>; data?: unknown } = {},
): Promise<{ status: number; ok: boolean; text: string }> {
  const response = await request[method](url, {
    headers: options.headers,
    data: options.data,
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  return { status: response.status(), ok: response.ok(), text: await responseBodyText(response) };
}

function isInterestingFailure(response: Response): boolean {
  if (response.status() < 400) return false;
  const url = response.url();
  return url.includes('/res/api/') || url.includes('/public/');
}

function failedResponseDiagnostics(failedResponses: FailedResponse[]): string {
  return [
    'Customer failed API responses:',
    failedResponses.length > 0
      ? failedResponses
          .map(
            (response) =>
              `${response.status} ${response.statusText || '<no status text>'} ${response.url}`,
          )
          .join('\n')
      : '<none>',
  ].join('\n');
}

async function visibleScreenDiagnostics(page: Page): Promise<string> {
  const diagnostics = await page.evaluate(() => {
    function isVisible(element: Element): boolean {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        rect.width > 0 &&
        rect.height > 0
      );
    }

    function texts(selector: string): string[] {
      return Array.from(document.querySelectorAll(selector))
        .filter(isVisible)
        .map((element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '')
        .filter(Boolean);
    }

    return {
      headings: texts('h1, h2, h3'),
      buttons: texts('button'),
      alerts: texts('[role="alert"], .text-red-600, .text-red-700, .text-rose-700'),
      bodyText: document.body.textContent?.replace(/\s+/g, ' ').trim().slice(0, 900) ?? '',
    };
  });

  return [
    'Customer visible screen diagnostics:',
    `visible headings: ${diagnostics.headings.join(' | ') || '<none>'}`,
    `visible button texts: ${diagnostics.buttons.join(' | ') || '<none>'}`,
    `visible alerts: ${diagnostics.alerts.join(' | ') || '<none>'}`,
    `visible body excerpt: ${diagnostics.bodyText || '<none>'}`,
  ].join('\n');
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

async function resetSeededTableState(
  request: APIRequestContext,
  fixture: CustomerOrderRequestFixture,
  posAuth: PosAuthHeaders,
  ownerAuth: PosAuthHeaders,
): Promise<TableResponse> {
  const required = requireCustomerOrderRequestFixture(fixture);
  const pending = await listPendingOrderRequests(request, posAuth);
  for (const orderRequest of pending.filter((item) => item.tableId === required.tableId)) {
    await rejectOrderRequest(
      request,
      posAuth,
      orderRequest.id,
      'E2E occupied customer table setup cleanup',
    ).catch(() => undefined);
  }

  const activeOrders = await listActiveOrdersForTable(request, ownerAuth, required.tableId);
  for (const order of activeOrders) {
    await cancelOrder(request, ownerAuth, order.id, 'E2E occupied customer table setup cleanup').catch(
      () => undefined,
    );
  }

  const remainingActive = await listActiveOrdersForTable(request, ownerAuth, required.tableId);
  expect(
    remainingActive,
    [
      'Setup could not clear active orders for seeded customer table.',
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
  createdRequestId?: string,
): Promise<void> {
  const required = requireCustomerOrderRequestFixture(fixture);
  if (createdRequestId) {
    const publicRequest = await getPublicOrderRequest(request, fixture, createdRequestId).catch(
      () => null,
    );
    if (publicRequest?.status === 'PENDING') {
      await rejectOrderRequest(
        request,
        posAuth,
        createdRequestId,
        'E2E occupied customer table cleanup',
      ).catch(() => undefined);
    }
  }

  const pending = await listPendingOrderRequests(request, posAuth).catch(() => []);
  for (const orderRequest of pending.filter((item) => item.tableId === required.tableId)) {
    await rejectOrderRequest(
      request,
      posAuth,
      orderRequest.id,
      'E2E occupied customer table cleanup',
    ).catch(() => undefined);
  }

  const activeOrders = await listActiveOrdersForTable(request, ownerAuth, required.tableId).catch(
    () => [],
  );
  for (const order of activeOrders.filter((item) => item.status && ACTIVE_ORDER_STATUSES.has(item.status))) {
    await cancelOrder(request, ownerAuth, order.id, 'E2E occupied customer table cleanup').catch(
      () => undefined,
    );
  }

  const table = await getTable(request, ownerAuth, required.tableId).catch(() => null);
  if (table && table.status !== 'AVAILABLE') {
    await changeTableStatus(request, ownerAuth, required.tableId, 'AVAILABLE').catch(() => undefined);
  }
}

async function createActiveSeededTableOrder(
  request: APIRequestContext,
  fixture: CustomerOrderRequestFixture,
  ownerAuth: PosAuthHeaders,
): Promise<OrderResponse> {
  const required = requireCustomerOrderRequestFixture(fixture);
  const order = await createDineInOrder(request, ownerAuth, required.tableId);
  await addOrderItem(request, ownerAuth, order.id, {
    menuItemId: required.dishId,
    quantity: 1,
    selectedOptionIds: required.modifierOptionIds,
  });
  const active = await sendOrderToKitchen(request, ownerAuth, order.id);

  expect(active.id, `Prepared active order should keep id ${order.id}.`).toBe(order.id);
  expect(active.tableId, `Prepared active order ${order.id} should stay on seeded table.`).toBe(
    required.tableId,
  );
  expect(active.status, `Prepared active order ${order.id} should be active.`).toBe(
    'SENT_TO_KITCHEN',
  );
  return active;
}

async function openOccupiedCustomerQrPage(
  page: Page,
  request: APIRequestContext,
  fixture: CustomerOrderRequestFixture,
): Promise<void> {
  const required = requireCustomerOrderRequestFixture(fixture);
  const customerUrl = customerUrlFromFixture(fixture);
  await expectFrontendReachable(request, 'customer occupied table QR menu', customerUrl);

  const response = await page.goto(customerUrl, { waitUntil: 'domcontentloaded' });
  if (!response || response.status() >= 500) {
    throw new Error(
      `Customer occupied table QR route did not load cleanly: ${response?.status() ?? '<no response>'} ${customerUrl}`,
    );
  }

  await expect(
    page.getByTestId('menu-root'),
    [
      'Occupied table customer QR page did not render the menu root.',
      `table id/name: ${required.tableId} / ${required.tableName}`,
      await visibleScreenDiagnostics(page),
    ].join('\n'),
  ).toBeVisible({ timeout: HANDOFF });

  await expect(
    page.getByTestId(`dish-card-${required.dishId}`).first(),
    `Seeded dish ${required.dishId} should be visible for occupied table add-on ordering.`,
  ).toBeVisible({ timeout: HANDOFF });
}

async function postPublicOrderRequest(
  request: APIRequestContext,
  fixture: CustomerOrderRequestFixture,
): Promise<{ accepted: true; id: string; text: string } | { accepted: false; status: number; text: string }> {
  const required = requireCustomerOrderRequestFixture(fixture);
  const payload = {
    qr: required.qr,
    items: [
      {
        menuItemId: required.dishId,
        quantity: 1,
        modifiers: required.modifierOptionIds.map((modifierOptionId) => ({ modifierOptionId })),
      },
    ],
  };

  const response = await requestText(request, 'post', `${ENV.apiBaseUrl}/public/order-requests`, {
    headers: publicHeaders(required.slug),
    data: payload,
  });

  if (!response.ok) {
    return { accepted: false, status: response.status, text: response.text };
  }

  const body = parseJsonBody<PublicOrderCreateResponse>(
    response.text,
    'POST /public/order-requests occupied table response',
  );
  expect(
    body.id,
    `POST /public/order-requests accepted occupied-table request but did not return id: ${response.text}`,
  ).toBeTruthy();
  expect(
    body.status,
    `POST /public/order-requests accepted occupied-table request with unexpected status: ${response.text}`,
  ).toBe('PENDING');

  return { accepted: true, id: body.id as string, text: response.text };
}

test.describe('customer occupied table QR behavior', () => {
  test('customer request from an occupied table merges safely without duplicate active orders', async ({
    page,
    request,
  }) => {
    const fixture = readFixtures() as CustomerOrderRequestFixture;
    const required = requireCustomerOrderRequestFixture(fixture);

    const failedResponses: FailedResponse[] = [];
    const pageErrors: string[] = [];
    page.on('response', (response) => {
      if (!isInterestingFailure(response)) return;
      failedResponses.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
      });
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await expectApiHealth(request, { label: 'primary API for occupied customer table behavior' });
    const posSession = await buildPosSession();
    const posAuth = posAuthHeaders(posSession);
    const ownerAuth = await seededOwnerAuthHeaders(request, fixture);

    let createdRequestId: string | undefined;
    let activeOrderId: string | undefined;

    try {
      const setupTable = await resetSeededTableState(request, fixture, posAuth, ownerAuth);
      expect(setupTable.status, `Seeded customer table should start AVAILABLE after cleanup.`).toBe(
        'AVAILABLE',
      );

      const activeOrder = await createActiveSeededTableOrder(request, fixture, ownerAuth);
      activeOrderId = activeOrder.id;

      const occupiedTable = await getTable(request, ownerAuth, required.tableId);
      expect(occupiedTable.status, `Seeded customer table should become OCCUPIED.`).toBe(
        'OCCUPIED',
      );

      const activeBefore = await listActiveOrdersForTable(request, ownerAuth, required.tableId);
      expect(
        activeBefore.map((order) => order.id),
        `Setup should leave exactly one active order on table ${required.tableId}.`,
      ).toEqual([activeOrder.id]);

      await openOccupiedCustomerQrPage(page, request, fixture);
      expect(
        pageErrors,
        `Occupied table customer page emitted uncaught page errors:\n${pageErrors.join('\n')}`,
      ).toHaveLength(0);

      const activeAfterOpen = await listActiveOrdersForTable(request, ownerAuth, required.tableId);
      expect(
        activeAfterOpen.map((order) => order.id),
        'Opening the occupied table QR page should not create a duplicate active order.',
      ).toEqual([activeOrder.id]);

      const requestResult = await postPublicOrderRequest(request, fixture);
      const activeAfterPost = await listActiveOrdersForTable(request, ownerAuth, required.tableId);
      expect(
        activeAfterPost.map((order) => order.id),
        [
          'Product bug: POST /public/order-requests created a duplicate active table order.',
          `existing order id: ${activeOrder.id}`,
          `active order ids: ${activeAfterPost.map((order) => order.id).join(', ') || '<none>'}`,
        ].join('\n'),
      ).toEqual([activeOrder.id]);

      if (!requestResult.accepted) {
        expect(
          [400, 409],
          `Occupied-table request rejection should be controlled 400/409.\nresponse: ${requestResult.text}`,
        ).toContain(requestResult.status);
        expect(
          errorCode(requestResult.text),
          `Occupied-table request rejection should expose a stable error code.\nresponse: ${requestResult.text}`,
        ).toBeTruthy();

        const pendingAfterReject = await listPendingOrderRequests(request, posAuth);
        expect(
          pendingAfterReject.filter((orderRequest) => orderRequest.tableId === required.tableId),
          'Rejected occupied-table public request should not leave a pending POS request.',
        ).toHaveLength(0);
        return;
      }

      createdRequestId = requestResult.id;

      const publicBeforeConfirm = await getPublicOrderRequest(request, fixture, requestResult.id);
      expect(publicBeforeConfirm.status, `Created occupied-table request should be PENDING.`).toBe(
        'PENDING',
      );

      const pendingBeforeConfirm = await listPendingOrderRequests(request, posAuth);
      expect(
        pendingBeforeConfirm.some((orderRequest) => orderRequest.id === requestResult.id),
        [
          `POS pending API did not include occupied-table request ${requestResult.id}.`,
          `table id/name: ${required.tableId} / ${required.tableName}`,
          `pending ids: ${pendingBeforeConfirm.map((orderRequest) => orderRequest.id).join(', ') || '<none>'}`,
        ].join('\n'),
      ).toBeTruthy();

      const beforeConfirmOrder = await getOrder(request, ownerAuth, activeOrder.id);
      const beforeItemCount = beforeConfirmOrder.items?.length ?? 0;
      const beforeOrderNumber = beforeConfirmOrder.orderNumber;
      const beforeTotal = beforeConfirmOrder.totals?.totalAmount ?? 0;

      const confirmedOrder = await confirmOrderRequest(request, posAuth, requestResult.id);
      expect(
        confirmedOrder.id,
        [
          'Product bug: occupied-table customer request did not merge into the existing active order.',
          `existing order id: ${activeOrder.id}`,
          `confirm response: ${JSON.stringify(confirmedOrder)}`,
        ].join('\n'),
      ).toBe(activeOrder.id);

      const publicAfterConfirm = await getPublicOrderRequest(request, fixture, requestResult.id);
      expect(publicAfterConfirm.status, `Occupied-table request should become CONFIRMED.`).toBe(
        'CONFIRMED',
      );

      const activeAfterConfirm = await listActiveOrdersForTable(request, ownerAuth, required.tableId);
      expect(
        activeAfterConfirm.map((order) => order.id),
        [
          'Product bug: confirming occupied-table request created duplicate active orders.',
          `existing order id: ${activeOrder.id}`,
          `active order ids: ${activeAfterConfirm.map((order) => order.id).join(', ') || '<none>'}`,
        ].join('\n'),
      ).toEqual([activeOrder.id]);

      const afterConfirmOrder = await getOrder(request, ownerAuth, activeOrder.id);
      expect(afterConfirmOrder.tableId, `Merged order should remain on seeded table.`).toBe(
        required.tableId,
      );
      expect(afterConfirmOrder.orderNumber, `Merged order number should remain stable.`).toBe(
        beforeOrderNumber,
      );
      expect(afterConfirmOrder.status, `Merged order status should remain stable.`).toBe(
        beforeConfirmOrder.status,
      );
      expect(
        afterConfirmOrder.items?.length ?? 0,
        `Merged order should include the requested add-on item.`,
      ).toBeGreaterThan(beforeItemCount);
      expect(
        afterConfirmOrder.totals?.totalAmount ?? 0,
        `Merged order total should not shrink after adding requested items.`,
      ).toBeGreaterThanOrEqual(beforeTotal);

      const tableAfterConfirm = await getTable(request, ownerAuth, required.tableId);
      expect(tableAfterConfirm.status, `Table should remain OCCUPIED after merge.`).toBe(
        'OCCUPIED',
      );

      const pendingAfterConfirm = await listPendingOrderRequests(request, posAuth);
      expect(
        pendingAfterConfirm.some((orderRequest) => orderRequest.id === requestResult.id),
        `Confirmed occupied-table request ${requestResult.id} should not remain pending.`,
      ).toBeFalsy();
      expect(
        pendingAfterConfirm.filter((orderRequest) => orderRequest.tableId === required.tableId),
        'Occupied table should not have leftover pending add-on requests after confirm.',
      ).toHaveLength(0);
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\n` +
          `fixture path: ${ENV.fixturesPath}\n` +
          `customer URL: ${customerUrlFromFixture(fixture)}\n` +
          `current page URL: ${page.url()}\n` +
          `active order id: ${activeOrderId ?? '<none>'}\n` +
          `created request id: ${createdRequestId ?? '<none>'}\n` +
          `${SEED_NOTE}\n` +
          `${await visibleScreenDiagnostics(page)}\n` +
          failedResponseDiagnostics(failedResponses),
      );
    } finally {
      await cleanupAfterTest(request, fixture, posAuth, ownerAuth, createdRequestId);
    }
  });
});
