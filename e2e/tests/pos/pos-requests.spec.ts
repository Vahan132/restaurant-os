import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import * as path from 'node:path';
import { ENV } from '../../config/env';
import { openActor, closeActor, type Actor } from '../../helpers/actors';
import { expectApiHealth, expectFrontendReachable } from '../../helpers/health';
import {
  createPendingCustomerOrderRequest,
  cancelOrder,
  getPublicOrderRequest,
  listActiveOrdersForTable,
  listPendingOrderRequests,
  parseJsonBody,
  posAuthHeaders,
  requireCustomerOrderRequestFixture,
  responseBodyText,
  seededOwnerAuthHeaders,
  type CustomerOrderRequestFixture,
  type OrderResponse,
} from '../../helpers/order-requests';
import { buildPosSession, readFixtures } from '../../helpers/session';
import { seedPosDeviceSecret } from '../../helpers/storage';

const ARTIFACTS = path.resolve(__dirname, '../../artifacts/actors-pos-requests');
const HANDOFF = 30_000;

async function visibleTexts(locator: Locator): Promise<string[]> {
  return locator.evaluateAll((elements) =>
    elements
      .map((element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      .filter((text) => text.length > 0),
  );
}

async function posDiagnostics(page: Page): Promise<string> {
  return [
    `visible POS buttons: ${(await visibleTexts(page.locator('button:visible'))).join(' | ') || '<none>'}`,
    `visible POS alerts: ${(await visibleTexts(page.locator('[role="alert"]:visible, .text-red-600:visible, .text-red-700:visible'))).join(' | ') || '<none>'}`,
  ].join('\n');
}

async function clearActiveOrdersForFixtureTable(
  request: APIRequestContext,
  fixture: CustomerOrderRequestFixture,
  fixtureData: ReturnType<typeof requireCustomerOrderRequestFixture>,
): Promise<void> {
  const cleanupAuth = await seededOwnerAuthHeaders(request, fixture);
  const activeOrders = await listActiveOrdersForTable(request, cleanupAuth, fixtureData.tableId);

  for (const order of activeOrders) {
    await cancelOrder(request, cleanupAuth, order.id, 'E2E pos-requests setup cleanup');
  }

  const remaining = await listActiveOrdersForTable(request, cleanupAuth, fixtureData.tableId);
  expect(
    remaining,
    [
      'Could not clear active orders for seeded table before POS request test.',
      `table id/name: ${fixtureData.tableId} / ${fixtureData.tableName}`,
      `remaining order ids/statuses: ${
        remaining.map((order) => `${order.id}:${order.status ?? '<unknown>'}`).join(', ') ||
        '<none>'
      }`,
    ].join('\n'),
  ).toHaveLength(0);
}

test.describe('POS customer order requests', () => {
  let pos: Actor | undefined;

  test.afterEach(async () => {
    if (pos) {
      await closeActor(pos, ARTIFACTS);
      pos = undefined;
    }
  });

  test('loads a pending customer order request and confirms it', async ({ browser, request }) => {
    const fixture = readFixtures() as CustomerOrderRequestFixture;
    const fixtureData = requireCustomerOrderRequestFixture(fixture);

    await expectFrontendReachable(request, 'POS on admin PC', ENV.posBaseUrl);
    await expectApiHealth(request, { label: 'primary API for POS request confirmation' });
    await clearActiveOrdersForFixtureTable(request, fixture, fixtureData);

    const created = await createPendingCustomerOrderRequest(request, fixture);
    const publicBefore = await getPublicOrderRequest(request, fixture, created.id);
    expect(publicBefore.status, `Created request ${created.id} was not PENDING.`).toBe('PENDING');

    const session = await buildPosSession();
    const auth = posAuthHeaders(session);
    const pendingBefore = await listPendingOrderRequests(request, auth);
    expect(
      pendingBefore.some((orderRequest) => orderRequest.id === created.id),
      [
        `POS API pending list did not include created request ${created.id}.`,
        `table id/name: ${fixtureData.tableId} / ${fixtureData.tableName}`,
        `pending ids: ${pendingBefore.map((orderRequest) => orderRequest.id).join(', ') || '<none>'}`,
      ].join('\n'),
    ).toBeTruthy();

    pos = await openActor(browser, 'pos', {
      artifactsDir: ARTIFACTS,
      baseURL: session.posHome,
      storageState: session.pos.storageState,
    });

    await pos.page.goto(session.posHome, { waitUntil: 'domcontentloaded' });
    await seedPosDeviceSecret(pos.page, session.pos.deviceSecret);
    await pos.page.reload({ waitUntil: 'domcontentloaded' });

    await expect(
      pos.page.getByTestId('requests-bell'),
      'POS did not render the order-requests bell. The POS session may be unauthenticated or missing ORDER_CREATE/ORDER_EDIT permissions.',
    ).toBeVisible({ timeout: HANDOFF });

    await pos.page.getByTestId('requests-bell').click();
    await expect(pos.page.getByTestId('requests-panel'), 'POS requests panel did not open.').toBeVisible({
      timeout: HANDOFF,
    });

    const requestCard = pos.page.locator(
      `[data-testid="request-card"][data-request-id="${created.id}"]`,
    );
    await expect(
      requestCard,
      [
        `POS did not show request card ${created.id}.`,
        `table id/name: ${fixtureData.tableId} / ${fixtureData.tableName}`,
      ].join('\n'),
    ).toBeVisible({ timeout: HANDOFF });

    const confirmButton = requestCard.getByTestId('request-confirm');
    await expect(
      confirmButton,
      `Confirm button is missing for request ${created.id}. POS user may lack ORDER_CREATE.`,
    ).toBeVisible({ timeout: HANDOFF });
    await expect(confirmButton, `Confirm button stayed disabled for request ${created.id}.`).toBeEnabled();

    const confirmResponsePromise = pos.page.waitForResponse((response) => {
      const req = response.request();
      return (
        req.method() === 'POST' &&
        response.url().includes(`/order-requests/${encodeURIComponent(created.id)}/confirm`)
      );
    });

    await confirmButton.click();

    const confirmResponse = await confirmResponsePromise;
    const confirmText = await responseBodyText(confirmResponse);
    if (!confirmResponse.ok()) {
      throw new Error(
        [
          `POST /order-requests/${created.id}/confirm failed: ${confirmResponse.status()} ${confirmText}`,
          `table id/name: ${fixtureData.tableId} / ${fixtureData.tableName}`,
          await posDiagnostics(pos.page),
        ].join('\n'),
      );
    }

    const confirmedOrder = parseJsonBody<OrderResponse>(
      confirmText,
      `POST /order-requests/${created.id}/confirm`,
    );
    expect(
      confirmedOrder.id,
      `Confirm response did not include an order id for request ${created.id}: ${confirmText}`,
    ).toBeTruthy();
    expect(
      confirmedOrder.tableId,
      `Confirm response order table did not match fixture table ${fixtureData.tableId}: ${confirmText}`,
    ).toBe(fixtureData.tableId);

    await expect(
      pos.page.getByTestId('open-confirmed-order'),
      `POS confirm API succeeded for request ${created.id}, but the post-confirm UI never appeared.`,
    ).toBeVisible({ timeout: HANDOFF });

    await expect
      .poll(
        async () => (await getPublicOrderRequest(request, fixture, created.id)).status,
        {
          timeout: HANDOFF,
          message: `Expected public request ${created.id} to become CONFIRMED.`,
        },
      )
      .toBe('CONFIRMED');

    const pendingAfter = await listPendingOrderRequests(request, auth);
    expect(
      pendingAfter.some((orderRequest) => orderRequest.id === created.id),
      [
        `Confirmed request ${created.id} is still present in POS pending API list.`,
        `table id/name: ${fixtureData.tableId} / ${fixtureData.tableName}`,
        `pending ids: ${pendingAfter.map((orderRequest) => orderRequest.id).join(', ') || '<none>'}`,
      ].join('\n'),
    ).toBeFalsy();
  });
});
