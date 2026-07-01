import { test, expect, type Locator, type Page } from '@playwright/test';
import * as path from 'node:path';
import { ENV } from '../../config/env';
import { openActor, closeActor, type Actor } from '../../helpers/actors';
import { expectApiHealth, expectFrontendReachable } from '../../helpers/health';
import {
  cancelOrder,
  confirmOrderRequest,
  createPendingCustomerOrderRequest,
  getOrder,
  getPublicOrderRequest,
  getStationTickets,
  kdsAuthHeaders,
  listActiveOrdersForTable,
  parseJsonBody,
  posAuthHeaders,
  requireCustomerOrderRequestFixture,
  responseBodyText,
  seededOwnerAuthHeaders,
  type CustomerOrderRequestFixture,
  type KdsAuthHeaders,
  type OrderItemResponse,
  type OrderResponse,
  type PosAuthHeaders,
} from '../../helpers/order-requests';
import { buildKdsSession, buildPosSession, readFixtures } from '../../helpers/session';
import { seedKdsDeviceSecret } from '../../helpers/storage';

const ARTIFACTS = path.resolve(__dirname, '../../artifacts/actors-kds-ticket');
const HANDOFF = 30_000;

interface KdsTicketFixture extends CustomerOrderRequestFixture {
  pos?: { deviceSecret?: string; userId?: string; pin?: string };
  kds?: {
    deviceSecret?: string;
    userId?: string;
    pin?: string;
    deviceSurface?: string;
    station?: string;
  };
}

function requireFixtureFieldSet(
  fixture: KdsTicketFixture,
  actor: 'pos' | 'kds',
  fields: string[],
): void {
  const value = fixture[actor] as Record<string, unknown> | undefined;
  const missing = fields
    .filter((field) => typeof value?.[field] !== 'string' || String(value[field]).length === 0)
    .map((field) => `${actor}.${field}`);

  if (missing.length > 0) {
    throw new Error(
      `Invalid KDS ticket E2E fixture: missing ${missing.join(', ')}.\n` +
        `fixture path: ${ENV.fixturesPath}\n` +
        'Run `pnpm db:seed` and then `pnpm db:seed:e2e` from the api workspace.',
    );
  }
}

function requireKdsTicketFixture(fixture: KdsTicketFixture): { station: string } {
  requireCustomerOrderRequestFixture(fixture);
  requireFixtureFieldSet(fixture, 'pos', ['deviceSecret', 'userId', 'pin']);
  requireFixtureFieldSet(fixture, 'kds', [
    'deviceSecret',
    'userId',
    'pin',
    'deviceSurface',
    'station',
  ]);

  const station = fixture.kds?.station as string;
  if (station !== 'KITCHEN') {
    throw new Error(
      `Invalid KDS ticket E2E fixture: expected kds.station to be KITCHEN, got ${station}.\n` +
        `fixture path: ${ENV.fixturesPath}`,
    );
  }

  return { station };
}

function orderItemIds(orders: OrderResponse[]): Set<string> {
  return new Set(orders.flatMap((order) => order.items?.map((item) => item.id) ?? []));
}

function requireSeededOrderItem(
  order: OrderResponse,
  fixtureData: ReturnType<typeof requireCustomerOrderRequestFixture>,
  previousItemIds: Set<string>,
  requestId: string,
): OrderItemResponse {
  const candidates = (order.items ?? []).filter(
    (item) => item.menuItemId === fixtureData.dishId && !previousItemIds.has(item.id),
  );

  if (candidates.length !== 1) {
    throw new Error(
      [
        `Could not identify the exact new KDS order item for request ${requestId}.`,
        `order id: ${order.id}`,
        `table id/name: ${fixtureData.tableId} / ${fixtureData.tableName}`,
        `seeded dish id: ${fixtureData.dishId}`,
        `matching new item ids: ${candidates.map((item) => item.id).join(', ') || '<none>'}`,
        `order items: ${JSON.stringify(order.items ?? [])}`,
      ].join('\n'),
    );
  }

  return candidates[0];
}

function requireItemStatus(
  order: OrderResponse,
  itemId: string,
  status: string,
  context: string,
): void {
  const item = order.items?.find((candidate) => candidate.id === itemId);
  expect(
    item?.status,
    `${context}: expected item ${itemId} to be ${status}. Order body: ${JSON.stringify(order)}`,
  ).toBe(status);
}

async function visibleTexts(locator: Locator): Promise<string[]> {
  return locator.evaluateAll((elements) =>
    elements
      .map((element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      .filter((text) => text.length > 0),
  );
}

async function kdsDiagnostics(page: Page): Promise<string> {
  return [
    `current URL: ${page.url()}`,
    `visible KDS headings: ${(await visibleTexts(page.locator('h1:visible, h2:visible, h3:visible'))).join(' | ') || '<none>'}`,
    `visible KDS buttons: ${(await visibleTexts(page.locator('button:visible'))).join(' | ') || '<none>'}`,
    `visible KDS alerts: ${(await visibleTexts(page.locator('[role="alert"]:visible, .text-status-delayed:visible, .text-red-600:visible, .text-red-700:visible'))).join(' | ') || '<none>'}`,
  ].join('\n');
}

async function stationItemStatus(
  request: Parameters<typeof getStationTickets>[0],
  auth: KdsAuthHeaders,
  station: string,
  orderId: string,
  itemId: string,
): Promise<string | null> {
  const tickets = await getStationTickets(request, auth, station);
  const ticket = tickets.find((candidate) => candidate.orderId === orderId);
  return ticket?.items.find((item) => item.orderItemId === itemId)?.status ?? null;
}

async function cancelActiveOrdersForSeededTable(
  request: Parameters<typeof listActiveOrdersForTable>[0],
  auth: PosAuthHeaders,
  fixtureData: ReturnType<typeof requireCustomerOrderRequestFixture>,
  reason: string,
): Promise<void> {
  const active = await listActiveOrdersForTable(request, auth, fixtureData.tableId);
  for (const order of active) {
    await cancelOrder(request, auth, order.id, reason);
  }

  const remaining = await listActiveOrdersForTable(request, auth, fixtureData.tableId);
  expect(
    remaining,
    [
      `Could not clear active orders for seeded table before KDS ticket test.`,
      `table id/name: ${fixtureData.tableId} / ${fixtureData.tableName}`,
      `remaining order ids/statuses: ${
        remaining.map((order) => `${order.id}:${order.status ?? '<unknown>'}`).join(', ') ||
        '<none>'
      }`,
    ].join('\n'),
  ).toHaveLength(0);
}

test.describe('KDS kitchen ticket', () => {
  let kds: Actor | undefined;

  test.afterEach(async () => {
    if (kds) {
      await closeActor(kds, ARTIFACTS);
      kds = undefined;
    }
  });

  test('shows a created ticket and marks its item preparing then ready', async ({
    browser,
    request,
  }) => {
    const fixture = readFixtures() as KdsTicketFixture;
    const fixtureData = requireCustomerOrderRequestFixture(fixture);
    const { station } = requireKdsTicketFixture(fixture);

    await expectFrontendReachable(request, 'KDS on display PC', ENV.kdsBaseUrl);
    await expectApiHealth(request, { label: 'primary API for KDS ticket test' });

    const cleanupAuth = await seededOwnerAuthHeaders(request, fixture);
    await cancelActiveOrdersForSeededTable(
      request,
      cleanupAuth,
      fixtureData,
      'E2E kds-ticket setup cleanup',
    );

    const createdRequest = await createPendingCustomerOrderRequest(request, fixture);
    const publicBefore = await getPublicOrderRequest(request, fixture, createdRequest.id);
    expect(publicBefore.status, `Created request ${createdRequest.id} was not PENDING.`).toBe(
      'PENDING',
    );

    const posSession = await buildPosSession();
    const posAuth = posAuthHeaders(posSession);
    const activeBefore = await listActiveOrdersForTable(request, posAuth, fixtureData.tableId);
    const existingItemIds = orderItemIds(activeBefore);

    const confirmed = await confirmOrderRequest(request, posAuth, createdRequest.id);
    const confirmedOrder =
      confirmed.items && confirmed.items.length > 0
        ? confirmed
        : await getOrder(request, posAuth, confirmed.id);
    expect(
      confirmedOrder.tableId,
      `Confirmed request ${createdRequest.id} created order ${confirmedOrder.id} for the wrong table.`,
    ).toBe(fixtureData.tableId);

    const orderItem = requireSeededOrderItem(
      confirmedOrder,
      fixtureData,
      existingItemIds,
      createdRequest.id,
    );
    expect(
      orderItem.status,
      `New item ${orderItem.id} for order ${confirmedOrder.id} should be kitchen-visible as SENT.`,
    ).toBe('SENT');

    await expect
      .poll(
        async () => (await getPublicOrderRequest(request, fixture, createdRequest.id)).status,
        {
          timeout: HANDOFF,
          message: `Expected public request ${createdRequest.id} to become CONFIRMED.`,
        },
      )
      .toBe('CONFIRMED');

    const kdsSession = await buildKdsSession();
    expect(kdsSession.kds.station, 'KDS session station must match seeded fixture.').toBe(station);
    const kdsAuth = kdsAuthHeaders(kdsSession);

    await expect
      .poll(
        async () =>
          stationItemStatus(request, kdsAuth, station, confirmedOrder.id, orderItem.id),
        {
          timeout: HANDOFF,
          message: [
            `KDS API did not expose order ${confirmedOrder.id} item ${orderItem.id} as SENT.`,
            `station: ${station}`,
            `table id/name: ${fixtureData.tableId} / ${fixtureData.tableName}`,
          ].join('\n'),
        },
      )
      .toBe('SENT');

    kds = await openActor(browser, 'kds', {
      artifactsDir: ARTIFACTS,
      baseURL: kdsSession.kdsHome,
      storageState: kdsSession.kds.storageState,
    });

    await kds.page.goto(kdsSession.kdsHome, { waitUntil: 'domcontentloaded' });
    await seedKdsDeviceSecret(kds.page, kdsSession.kds.deviceSecret, kdsSession.kds.surface);
    await kds.page.reload({ waitUntil: 'domcontentloaded' });

    await expect(
      kds.page.getByTestId('kds-board'),
      [
        `KDS board did not render for station ${station}.`,
        `order id: ${confirmedOrder.id}`,
        `item id: ${orderItem.id}`,
      ].join('\n'),
    ).toBeVisible({ timeout: HANDOFF });

    const ticket = kds.page.locator(
      `[data-testid="kds-ticket"][data-order-id="${confirmedOrder.id}"]`,
    );
    await expect(
      ticket,
      [
        `KDS did not show ticket for order ${confirmedOrder.id}.`,
        `station: ${station}`,
        `table id/name: ${fixtureData.tableId} / ${fixtureData.tableName}`,
        await kdsDiagnostics(kds.page),
      ].join('\n'),
    ).toBeVisible({ timeout: HANDOFF });

    const item = ticket.locator(`[data-testid="kds-item"][data-order-item-id="${orderItem.id}"]`);
    await expect(
      item,
      [
        `KDS ticket ${confirmedOrder.id} did not show item ${orderItem.id}.`,
        `seeded dish id: ${fixtureData.dishId}`,
        await kdsDiagnostics(kds.page),
      ].join('\n'),
    ).toBeVisible({ timeout: HANDOFF });
    await expect(item, `KDS item ${orderItem.id} did not start as SENT.`).toHaveAttribute(
      'data-status',
      'SENT',
      { timeout: HANDOFF },
    );

    const startButton = item.getByTestId('kds-item-start');
    await expect(
      startButton,
      `Start/preparing button is missing for KDS item ${orderItem.id}.`,
    ).toBeVisible();
    await expect(startButton, `Start/preparing button stayed disabled for ${orderItem.id}.`).toBeEnabled();

    const preparingResponsePromise = kds.page.waitForResponse((response) => {
      const req = response.request();
      return (
        req.method() === 'POST' &&
        response.url().includes(`/kds/order-items/${encodeURIComponent(orderItem.id)}/preparing`)
      );
    });

    await startButton.click();

    const preparingResponse = await preparingResponsePromise;
    const preparingText = await responseBodyText(preparingResponse);
    if (!preparingResponse.ok()) {
      throw new Error(
        [
          `POST /kds/order-items/${orderItem.id}/preparing failed: ${preparingResponse.status()} ${preparingText}`,
          `order id: ${confirmedOrder.id}`,
          `station: ${station}`,
          `table id/name: ${fixtureData.tableId} / ${fixtureData.tableName}`,
          await kdsDiagnostics(kds.page),
        ].join('\n'),
      );
    }
    requireItemStatus(
      parseJsonBody<OrderResponse>(
        preparingText,
        `POST /kds/order-items/${orderItem.id}/preparing`,
      ),
      orderItem.id,
      'PREPARING',
      `Preparing response for order ${confirmedOrder.id}`,
    );
    await expect(item, `KDS item ${orderItem.id} never rendered PREPARING.`).toHaveAttribute(
      'data-status',
      'PREPARING',
      { timeout: HANDOFF },
    );
    await expect
      .poll(
        async () =>
          stationItemStatus(request, kdsAuth, station, confirmedOrder.id, orderItem.id),
        {
          timeout: HANDOFF,
          message: `KDS API did not show item ${orderItem.id} on order ${confirmedOrder.id} as PREPARING.`,
        },
      )
      .toBe('PREPARING');

    const readyButton = item.getByTestId('kds-item-ready');
    await expect(readyButton, `Ready button is missing for KDS item ${orderItem.id}.`).toBeVisible();
    await expect(readyButton, `Ready button stayed disabled for ${orderItem.id}.`).toBeEnabled();

    const readyResponsePromise = kds.page.waitForResponse((response) => {
      const req = response.request();
      return (
        req.method() === 'POST' &&
        response.url().includes(`/kds/order-items/${encodeURIComponent(orderItem.id)}/ready`)
      );
    });

    await readyButton.click();

    const readyResponse = await readyResponsePromise;
    const readyText = await responseBodyText(readyResponse);
    if (!readyResponse.ok()) {
      throw new Error(
        [
          `POST /kds/order-items/${orderItem.id}/ready failed: ${readyResponse.status()} ${readyText}`,
          `order id: ${confirmedOrder.id}`,
          `station: ${station}`,
          `table id/name: ${fixtureData.tableId} / ${fixtureData.tableName}`,
          await kdsDiagnostics(kds.page),
        ].join('\n'),
      );
    }
    requireItemStatus(
      parseJsonBody<OrderResponse>(readyText, `POST /kds/order-items/${orderItem.id}/ready`),
      orderItem.id,
      'READY',
      `Ready response for order ${confirmedOrder.id}`,
    );
    await expect(item, `KDS item ${orderItem.id} never rendered READY.`).toHaveAttribute(
      'data-status',
      'READY',
      { timeout: HANDOFF },
    );
    await expect
      .poll(
        async () =>
          stationItemStatus(request, kdsAuth, station, confirmedOrder.id, orderItem.id),
        {
          timeout: HANDOFF,
          message: `KDS API did not show item ${orderItem.id} on order ${confirmedOrder.id} as READY.`,
        },
      )
      .toBe('READY');

    await cancelOrder(
      request,
      cleanupAuth,
      confirmedOrder.id,
      'E2E kds-ticket cleanup after READY assertion',
    );
  });
});
