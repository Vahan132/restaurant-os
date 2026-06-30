import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import * as path from 'node:path';
import { ENV, customerUrlFromFixture, type SeededFixture } from '../../config/env';
import { openActor, closeActor, type Actor } from '../../helpers/actors';
import { pinLogin, type PinLoginResult } from '../../helpers/api';
import { preflightAllFlow } from '../../helpers/health';
import { buildSession, readFixtures, type E2ESession } from '../../helpers/session';
import { seedKdsDeviceSecret, seedPosDeviceSecret } from '../../helpers/storage';

const ARTIFACTS = path.resolve(__dirname, '../../artifacts/actors');
const HANDOFF = 30_000;
const CLEANUP_REASON = 'E2E all-flow cleanup';

interface FlowTable {
  id: string;
  name: string;
}

interface FlowDish {
  id: string;
  modifiers: {
    donenessMedium: string;
    sideFries: string;
  };
}

interface FlowActorFixture {
  deviceSecret: string;
  userId: string;
  pin: string;
}

interface FlowFixture extends SeededFixture {
  manager?: FlowActorFixture;
}

interface ApiList<T> {
  data: T[];
}

interface ApiOrder {
  id: string;
  status: string;
  tableId?: string | null;
  orderNumber?: number | string;
}

interface ApiOrderRequest {
  id: string;
  status: string;
  tableId: string;
  tableName?: string | null;
  linkedOrderId?: string | null;
}

interface CleanupAuth {
  accessToken: string;
  branchId: string;
  source: 'manager' | 'pos';
  approvedByUserId?: string;
}

interface PublicOrderRequestCreateResponse {
  id: string;
  status: string;
}

interface ConfirmFailureDiagnostics {
  requestId: string;
  tableName: string;
  status: number;
  body: string;
  visibleButtons: string[];
  visibleAlerts: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unwrapApiBody<T>(body: unknown): T {
  // Backend responses may be enveloped as { data: resource }. Paginated list
  // responses may also be returned directly as { data: items, pagination }.
  if (isRecord(body) && 'data' in body && !('pagination' in body)) {
    return body.data as T;
  }
  return body as T;
}

async function jsonOrText(response: { json: () => Promise<unknown>; text: () => Promise<string> }): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return response.text();
  }
}

async function bodyText(response: { text: () => Promise<string> }): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    return `<failed to read body: ${error instanceof Error ? error.message : String(error)}>`;
  }
}

function getLocalStorageValue(session: E2ESession, storageKey: string): string {
  for (const origin of session.pos.storageState.origins) {
    const item = origin.localStorage.find((entry) => entry.name === storageKey);
    if (item) return item.value;
  }
  throw new Error(`Could not find ${storageKey} in POS storage state.`);
}

function getPosCleanupAuth(session: E2ESession): CleanupAuth {
  const auth = JSON.parse(getLocalStorageValue(session, 'pos-auth')) as {
    state?: { accessToken?: unknown };
  };
  const branch = JSON.parse(getLocalStorageValue(session, 'pos-branch')) as {
    state?: { activeBranchId?: unknown };
  };

  const accessToken = auth.state?.accessToken;
  const branchId = branch.state?.activeBranchId;

  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new Error('Could not extract POS accessToken from storage state.');
  }
  if (typeof branchId !== 'string' || branchId.length === 0) {
    throw new Error('Could not extract POS activeBranchId from storage state.');
  }

  return { accessToken, branchId, source: 'pos' };
}

async function getCleanupAuth(fixtures: FlowFixture, session: E2ESession): Promise<CleanupAuth> {
  if (fixtures.manager?.deviceSecret && fixtures.manager.userId && fixtures.manager.pin) {
    const managerLogin: PinLoginResult = await pinLogin(
      {
        deviceSecret: fixtures.manager.deviceSecret,
        userId: fixtures.manager.userId,
        pin: fixtures.manager.pin,
      },
      { actorLabel: 'E2E cleanup manager' },
    );

    return {
      accessToken: managerLogin.accessToken,
      branchId: managerLogin.branchId,
      source: 'manager',
      approvedByUserId: fixtures.manager.userId,
    };
  }

  return getPosCleanupAuth(session);
}

function authHeaders(auth: CleanupAuth): Record<string, string> {
  return {
    authorization: `Bearer ${auth.accessToken}`,
    'x-branch-id': auth.branchId,
    'content-type': 'application/json',
  };
}

async function apiGet<T>(request: APIRequestContext, auth: CleanupAuth, url: string): Promise<T> {
  const response = await request.get(url, { headers: authHeaders(auth) });
  if (!response.ok()) {
    throw new Error(`GET ${url} failed: ${response.status()} ${await bodyText(response)}`);
  }
  return unwrapApiBody<T>(await jsonOrText(response));
}

async function apiPost<T>(
  request: APIRequestContext,
  auth: CleanupAuth,
  url: string,
  data?: Record<string, unknown>,
): Promise<T> {
  const response = await request.post(url, { headers: authHeaders(auth), data });
  if (!response.ok()) {
    throw new Error(`POST ${url} failed: ${response.status()} ${await bodyText(response)}`);
  }
  return unwrapApiBody<T>(await jsonOrText(response));
}

async function rejectPendingRequestsForTable(
  request: APIRequestContext,
  auth: CleanupAuth,
  table: FlowTable,
): Promise<string[]> {
  const url = `${ENV.apiBaseUrl}/order-requests?status=PENDING&limit=100`;
  const body = await apiGet<ApiList<ApiOrderRequest>>(request, auth, url);
  const staleRequests = body.data.filter((item) => item.tableId === table.id);

  for (const staleRequest of staleRequests) {
    await apiPost<ApiOrderRequest>(
      request,
      auth,
      `${ENV.apiBaseUrl}/order-requests/${encodeURIComponent(staleRequest.id)}/reject`,
      { reason: CLEANUP_REASON },
    );
  }

  return staleRequests.map((item) => item.id);
}

async function cancelActiveOrdersForTable(
  request: APIRequestContext,
  auth: CleanupAuth,
  table: FlowTable,
): Promise<string[]> {
  const params = new URLSearchParams({ tableId: table.id, includeInactive: 'false', limit: '100' });
  const url = `${ENV.apiBaseUrl}/orders?${params.toString()}`;
  const body = await apiGet<ApiList<ApiOrder>>(request, auth, url);
  const activeOrders = body.data.filter((order) => !['CLOSED', 'CANCELLED'].includes(order.status));

  for (const order of activeOrders) {
    await apiPost<ApiOrder>(
      request,
      auth,
      `${ENV.apiBaseUrl}/orders/${encodeURIComponent(order.id)}/cancel`,
      auth.approvedByUserId
        ? { reason: CLEANUP_REASON, approvedByUserId: auth.approvedByUserId }
        : { reason: CLEANUP_REASON },
    );
  }

  return activeOrders.map((order) => `${order.id}:${order.status}`);
}

async function resetFixtureTableState(
  request: APIRequestContext,
  fixtures: FlowFixture,
  session: E2ESession,
  table: FlowTable,
): Promise<void> {
  const auth = await getCleanupAuth(fixtures, session);
  const rejectedRequestIds = await rejectPendingRequestsForTable(request, auth, table);
  const cancelledOrderIds = await cancelActiveOrdersForTable(request, auth, table);

  // Re-check after cleanup so the test fails early with a state error instead
  // of later surfacing as ORDER_NOT_MUTABLE during confirm.
  const remainingOrders = await apiGet<ApiList<ApiOrder>>(
    request,
    auth,
    `${ENV.apiBaseUrl}/orders?${new URLSearchParams({
      tableId: table.id,
      includeInactive: 'false',
      limit: '100',
    }).toString()}`,
  );
  const remainingRequests = await apiGet<ApiList<ApiOrderRequest>>(
    request,
    auth,
    `${ENV.apiBaseUrl}/order-requests?status=PENDING&limit=100`,
  );
  const pendingForTable = remainingRequests.data.filter((item) => item.tableId === table.id);

  if (remainingOrders.data.length > 0 || pendingForTable.length > 0) {
    throw new Error(
      [
        `E2E cleanup did not leave table "${table.name}" clean.`,
        `cleanup auth source: ${auth.source}`,
        `rejected request IDs: ${rejectedRequestIds.join(', ') || '<none>'}`,
        `cancelled order IDs/statuses: ${cancelledOrderIds.join(', ') || '<none>'}`,
        `remaining active orders: ${JSON.stringify(remainingOrders.data)}`,
        `remaining pending requests: ${JSON.stringify(pendingForTable)}`,
      ].join('\n'),
    );
  }
}

async function readRequestIds(cards: Locator): Promise<string[]> {
  return cards.evaluateAll((elements) =>
    elements
      .map((element) => element.getAttribute('data-request-id'))
      .filter((id): id is string => Boolean(id)),
  );
}

async function waitForNewRequestId(
  requestCardsForTable: Locator,
  existingRequestIds: Set<string>,
  tableName: string,
  expectedRequestId?: string,
): Promise<string> {
  let newRequestId: string | null = null;

  await expect
    .poll(
      async () => {
        const currentRequestIds = await readRequestIds(requestCardsForTable);
        newRequestId = expectedRequestId && currentRequestIds.includes(expectedRequestId)
          ? expectedRequestId
          : currentRequestIds.find((requestId) => !existingRequestIds.has(requestId)) ?? null;

        return newRequestId;
      },
      {
        timeout: HANDOFF,
        message: `Expected a new POS request card for table "${tableName}"`,
      },
    )
    .not.toBeNull();

  if (!newRequestId) {
    throw new Error(`Expected a new POS request card for table "${tableName}", but none appeared.`);
  }

  return newRequestId;
}

async function waitForCustomerOrderStatus(page: Page, expectedStatus: string): Promise<void> {
  await expect
    .poll(
      async () => {
        const orderStatus = page.getByTestId('order-status');
        const currentStatus = await orderStatus.getAttribute('data-status').catch(() => null);

        if (currentStatus === expectedStatus) {
          return currentStatus;
        }

        // Customer status polls every few seconds, but remote split-origin E2E can
        // miss a refetch. A reload still verifies the public status endpoint/state.
        await page.reload({ waitUntil: 'domcontentloaded' });
        return page.getByTestId('order-status').getAttribute('data-status').catch(() => null);
      },
      {
        timeout: HANDOFF,
        message: `Expected customer order status to become ${expectedStatus}`,
      },
    )
    .toBe(expectedStatus);
}

async function visibleTexts(locator: Locator): Promise<string[]> {
  return locator.evaluateAll((elements) =>
    elements
      .map((element) => element.textContent?.trim() ?? '')
      .filter((text) => text.length > 0),
  );
}

async function confirmFailureDiagnostics(input: ConfirmFailureDiagnostics): Promise<string> {
  return [
    `POS request confirm failed for table "${input.tableName}".`,
    `request ID: ${input.requestId}`,
    `confirm response: ${input.status}`,
    `confirm body: ${input.body}`,
    `visible POS buttons: ${input.visibleButtons.join(' | ') || '<none>'}`,
    `visible POS alerts: ${input.visibleAlerts.join(' | ') || '<none>'}`,
  ].join('\n');
}

test.describe('order lifecycle across POS, API, KDS, and customer', () => {
  let qr: Actor | undefined;
  let pos: Actor | undefined;
  let kds: Actor | undefined;

  test.afterAll(async () => {
    for (const actor of [qr, pos, kds]) {
      if (actor) await closeActor(actor, ARTIFACTS);
    }
  });

  test('places, confirms, cooks, and propagates a QR order', async ({ browser, request }) => {
    const fixtures = readFixtures() as FlowFixture;
    await preflightAllFlow(request, { customerUrl: customerUrlFromFixture(fixtures) });

    const session: E2ESession = await buildSession();
    const table = session.table as unknown as FlowTable;
    const dish = session.dish as unknown as FlowDish;

    await resetFixtureTableState(request, fixtures, session, table);

    pos = await openActor(browser, 'pos', {
      artifactsDir: ARTIFACTS,
      baseURL: session.posHome,
      storageState: session.pos.storageState,
    });

    kds = await openActor(browser, 'kds', {
      artifactsDir: ARTIFACTS,
      baseURL: session.kdsHome,
      storageState: session.kds.storageState,
    });

    qr = await openActor(browser, 'qr', {
      artifactsDir: ARTIFACTS,
      baseURL: session.customerHome,
    });

    await pos.page.goto(session.posHome, { waitUntil: 'domcontentloaded' });
    await seedPosDeviceSecret(pos.page, session.pos.deviceSecret);
    await pos.page.reload({ waitUntil: 'domcontentloaded' });
    await expect(pos.page.getByTestId('requests-bell')).toBeVisible({ timeout: HANDOFF });

    await kds.page.goto(session.kdsHome, { waitUntil: 'domcontentloaded' });
    await seedKdsDeviceSecret(kds.page, session.kds.deviceSecret, session.kds.surface);
    await kds.page.reload({ waitUntil: 'domcontentloaded' });
    await expect(kds.page.getByTestId('kds-board')).toBeVisible({ timeout: HANDOFF });

    await pos.page.getByTestId('requests-bell').click();
    await expect(pos.page.getByTestId('requests-panel')).toBeVisible();

    const requestCardsForTable = pos.page.locator(
      `[data-testid="request-card"][data-table-name="${table.name}"]`,
    );
    const existingRequestIds = new Set(await readRequestIds(requestCardsForTable));

    await qr.page.goto(session.customerUrl, { waitUntil: 'domcontentloaded' });
    await expect(qr.page.getByTestId('menu-root')).toBeVisible({ timeout: HANDOFF });

    await qr.page.getByTestId(`dish-card-${dish.id}`).click();
    await expect(qr.page.getByTestId('item-sheet')).toBeVisible();

    await expect(qr.page.getByTestId('modifier-group').first()).toBeVisible();
    await qr.page.locator(`[data-option-id="${dish.modifiers.donenessMedium}"]`).check();
    await qr.page.locator(`[data-option-id="${dish.modifiers.sideFries}"]`).check();

    const addToCart = qr.page.getByTestId('add-to-cart');
    await expect(addToCart).toBeEnabled();
    await addToCart.click();

    await qr.page.getByTestId('open-cart').click();
    await expect(qr.page.getByTestId('cart-view')).toBeVisible();

    const placeOrderResponsePromise = qr.page.waitForResponse((response) => {
      const req = response.request();
      return req.method() === 'POST' && response.url().includes('/public/order-requests');
    });

    await qr.page.getByTestId('place-order').click();

    const placeOrderResponse = await placeOrderResponsePromise;
    const placeOrderText = await bodyText(placeOrderResponse);
    expect(placeOrderResponse.ok(), placeOrderText).toBeTruthy();

    const placeOrderBody = unwrapApiBody<PublicOrderRequestCreateResponse>(JSON.parse(placeOrderText));
    expect(placeOrderBody.id, `Unexpected place-order response: ${placeOrderText}`).toBeTruthy();

    await expect(qr.page.getByTestId('order-status')).toBeVisible({ timeout: HANDOFF });

    const newRequestId = await waitForNewRequestId(
      requestCardsForTable,
      existingRequestIds,
      table.name,
      placeOrderBody.id,
    );

    const posCard = pos.page.locator(
      `[data-testid="request-card"][data-request-id="${newRequestId}"]`,
    );
    await expect(posCard).toBeVisible({ timeout: HANDOFF });

    const confirmButton = posCard.getByTestId('request-confirm');
    await expect(confirmButton).toBeVisible({ timeout: HANDOFF });
    await expect(confirmButton).toBeEnabled();

    const confirmResponsePromise = pos.page.waitForResponse((response) => {
      const req = response.request();
      return (
        req.method() === 'POST' &&
        response.url().includes(`/order-requests/${newRequestId}/confirm`)
      );
    });

    await confirmButton.click();

    const confirmResponse = await confirmResponsePromise;
    const confirmText = await bodyText(confirmResponse);

    if (!confirmResponse.ok()) {
      throw new Error(
        await confirmFailureDiagnostics({
          requestId: newRequestId,
          tableName: table.name,
          status: confirmResponse.status(),
          body: confirmText,
          visibleButtons: await visibleTexts(pos.page.locator('button:visible')),
          visibleAlerts: await visibleTexts(pos.page.locator('[role="alert"]:visible')),
        }),
      );
    }

    const confirmedOrder = unwrapApiBody<ApiOrder>(JSON.parse(confirmText));
    expect(confirmedOrder.id, `Unexpected confirm response: ${confirmText}`).toBeTruthy();

    const openConfirmedOrder = pos.page.getByTestId('open-confirmed-order');
    const posOrderStatus = pos.page.getByTestId('pos-order-status');

    const modalAppeared = await openConfirmedOrder
      .waitFor({ state: 'visible', timeout: HANDOFF })
      .then(() => true)
      .catch(() => false);
    if (modalAppeared) {
      await expect(openConfirmedOrder).toBeEnabled();
      await openConfirmedOrder.click();
      await expect(posOrderStatus).toBeVisible({ timeout: HANDOFF });
    } else if (await posOrderStatus.isVisible().catch(() => false)) {
      await expect(posOrderStatus).toBeVisible({ timeout: HANDOFF });
    } else {
      throw new Error(
        [
          'POS confirm API succeeded, but neither the post-confirm modal nor POS order detail appeared.',
          `request ID: ${newRequestId}`,
          `table: ${table.name}`,
          `confirm body: ${confirmText}`,
          `visible POS buttons: ${(await visibleTexts(pos.page.locator('button:visible'))).join(' | ') || '<none>'}`,
        ].join('\n'),
      );
    }

    await waitForCustomerOrderStatus(qr.page, 'CONFIRMED');

    const ticket = kds.page.locator(
      `[data-testid="kds-ticket"][data-order-id="${confirmedOrder.id}"]`,
    );
    await expect(ticket).toBeVisible({ timeout: HANDOFF });

    await ticket.getByTestId('kds-item-start').first().click();
    await expect(ticket.getByTestId('kds-item').first()).toHaveAttribute(
      'data-status',
      'PREPARING',
      { timeout: HANDOFF },
    );

    await ticket.getByTestId('kds-item-ready').first().click();
    await expect(ticket.getByTestId('kds-item').first()).toHaveAttribute(
      'data-status',
      'READY',
      { timeout: HANDOFF },
    );

    await expect(posOrderStatus).toHaveAttribute('data-status', 'READY', {
      timeout: HANDOFF,
    });
  });
});
