import {
  test,
  expect,
  type APIRequestContext,
  type BrowserContextOptions,
  type Locator,
  type Page,
} from '@playwright/test';
import * as path from 'node:path';
import { ENV } from '../../config/env';
import { openActor, closeActor, type Actor } from '../../helpers/actors';
import { expectApiHealth, expectFrontendReachable } from '../../helpers/health';
import {
  addOrderItem,
  cancelOrder,
  createDineInOrder,
  getMenuTree,
  getOrder,
  getStationTickets,
  kdsAuthHeaders,
  listActiveOrdersForTable,
  parseJsonBody,
  posAuthHeaders,
  requireCustomerOrderRequestFixture,
  responseBodyText,
  seededOwnerAuthHeaders,
  sendOrderToKitchen,
  type CustomerOrderRequestFixture,
  type KdsAuthHeaders,
  type KdsTicketResponse,
  type MenuTreeItem,
  type OrderItemResponse,
  type OrderResponse,
  type PosAuthHeaders,
} from '../../helpers/order-requests';
import { buildKdsSession, buildPosSession, readFixtures } from '../../helpers/session';
import { seedKdsDeviceSecret } from '../../helpers/storage';

const ARTIFACTS = path.resolve(__dirname, '../../artifacts/actors-kds-multi-station-completion');
const HANDOFF = 30_000;
const KITCHEN_STATION = 'KITCHEN';
const BAR_STATION = 'BAR';

type BrowserStorageState = Exclude<NonNullable<BrowserContextOptions['storageState']>, string>;
type Station = typeof KITCHEN_STATION | typeof BAR_STATION;

interface KdsMultiStationFixture extends CustomerOrderRequestFixture {
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
  fixture: KdsMultiStationFixture,
  actor: 'pos' | 'kds',
  fields: string[],
): void {
  const value = fixture[actor] as Record<string, unknown> | undefined;
  const missing = fields
    .filter((field) => typeof value?.[field] !== 'string' || String(value[field]).length === 0)
    .map((field) => `${actor}.${field}`);

  if (missing.length > 0) {
    throw new Error(
      `Invalid KDS multi-station E2E fixture: missing ${missing.join(', ')}.\n` +
        `fixture path: ${ENV.fixturesPath}\n` +
        'Run `pnpm db:seed` and then `pnpm db:seed:e2e` from the api workspace.',
    );
  }
}

function requireKdsMultiStationFixture(fixture: KdsMultiStationFixture): void {
  requireCustomerOrderRequestFixture(fixture);
  requireFixtureFieldSet(fixture, 'pos', ['deviceSecret', 'userId', 'pin']);
  requireFixtureFieldSet(fixture, 'kds', [
    'deviceSecret',
    'userId',
    'pin',
    'deviceSurface',
    'station',
  ]);

  if (fixture.kds?.station !== KITCHEN_STATION) {
    throw new Error(
      `Invalid KDS multi-station fixture: expected seeded kds.station to be KITCHEN, got ${fixture.kds?.station}.\n` +
        'This test intentionally overrides the browser-pinned station to BAR for BAR board assertions.',
    );
  }
}

function requireObjectStorageState(
  storageState: BrowserContextOptions['storageState'],
): BrowserStorageState {
  if (!storageState || typeof storageState === 'string') {
    throw new Error(
      'KDS session storageState must be an object for station override. Received path/undefined storageState.',
    );
  }

  return storageState;
}

function storageStatePinnedToStation(
  storageState: BrowserContextOptions['storageState'],
  station: Station,
): BrowserStorageState {
  const state = requireObjectStorageState(storageState);

  const copy: BrowserStorageState = {
    cookies: [...state.cookies],
    origins: state.origins.map((origin) => ({
      origin: origin.origin,
      localStorage: origin.localStorage.map((entry) => ({ ...entry })),
    })),
  };

  let updated = false;

  for (const origin of copy.origins) {
    const item = origin.localStorage.find((entry) => entry.name === 'kds-station');
    if (item) {
      item.value = JSON.stringify({ state: { station }, version: 0 });
      updated = true;
    }
  }

  if (!updated) {
    throw new Error('Could not find kds-station in KDS storage state.');
  }

  return copy;
}

function flattenMenuItems(categories: Awaited<ReturnType<typeof getMenuTree>>): MenuTreeItem[] {
  return categories.flatMap((category) => category.items);
}

function hasRequiredModifiers(item: MenuTreeItem): boolean {
  return item.modifierGroups.some((group) => group.required || (group.minSelect ?? 0) > 0);
}

function requireAvailableBarItem(items: MenuTreeItem[]): MenuTreeItem {
  const candidates = items.filter(
    (item) =>
      item.preparationStation === BAR_STATION &&
      item.availability === 'AVAILABLE' &&
      !hasRequiredModifiers(item),
  );

  if (candidates.length === 0) {
    throw new Error(
      [
        'Could not find an available BAR menu item without required modifiers.',
        `BAR items: ${
          items
            .filter((item) => item.preparationStation === BAR_STATION)
            .map((item) => `${item.id}:${item.name}:${item.availability}`)
            .join(', ') || '<none>'
        }`,
      ].join('\n'),
    );
  }

  return candidates[0];
}

function requireOrderItem(
  order: OrderResponse,
  input: { menuItemId: string; station: Station; label: string },
): OrderItemResponse {
  const candidates = (order.items ?? []).filter(
    (item) => item.menuItemId === input.menuItemId && item.preparationStation === input.station,
  );

  if (candidates.length !== 1) {
    throw new Error(
      [
        `Could not identify exactly one ${input.label} order item.`,
        `order id: ${order.id}`,
        `menu item id: ${input.menuItemId}`,
        `station: ${input.station}`,
        `matching item ids: ${candidates.map((item) => item.id).join(', ') || '<none>'}`,
        `order items: ${JSON.stringify(order.items ?? [])}`,
      ].join('\n'),
    );
  }

  return candidates[0];
}

function requireOrderItemStatus(
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

function ticketForOrder(tickets: KdsTicketResponse[], orderId: string): KdsTicketResponse | null {
  return tickets.find((ticket) => ticket.orderId === orderId) ?? null;
}

function ticketContainsItem(
  tickets: KdsTicketResponse[],
  orderId: string,
  itemId: string,
): boolean {
  return ticketForOrder(tickets, orderId)?.items.some((item) => item.orderItemId === itemId) ?? false;
}

function ticketItemStatus(
  tickets: KdsTicketResponse[],
  orderId: string,
  itemId: string,
): string | null {
  return (
    ticketForOrder(tickets, orderId)?.items.find((item) => item.orderItemId === itemId)?.status ??
    null
  );
}

function ticketPendingItemIds(tickets: KdsTicketResponse[], orderId: string): string[] {
  return (
    ticketForOrder(tickets, orderId)?.items
      .filter((item) => item.status !== 'READY')
      .map((item) => item.orderItemId) ?? []
  );
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

async function cancelActiveOrdersForSeededTable(
  request: APIRequestContext,
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
      'Could not clear active orders for seeded table before KDS multi-station completion test.',
      `table id/name: ${fixtureData.tableId} / ${fixtureData.tableName}`,
      `remaining order ids/statuses: ${
        remaining.map((order) => `${order.id}:${order.status ?? '<unknown>'}`).join(', ') ||
        '<none>'
      }`,
    ].join('\n'),
  ).toHaveLength(0);
}

async function expectStationTicketContainsOnlyItem(
  request: APIRequestContext,
  auth: KdsAuthHeaders,
  station: Station,
  orderId: string,
  expectedItemId: string,
  excludedItemId: string,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const tickets = await getStationTickets(request, auth, station);
        return {
          includesExpected: ticketContainsItem(tickets, orderId, expectedItemId),
          expectedStatus: ticketItemStatus(tickets, orderId, expectedItemId),
          includesExcluded: ticketContainsItem(tickets, orderId, excludedItemId),
        };
      },
      {
        timeout: HANDOFF,
        message: `Expected ${station} KDS API ticket for order ${orderId} to include only station item ${expectedItemId}.`,
      },
    )
    .toMatchObject({
      includesExpected: true,
      expectedStatus: 'SENT',
      includesExcluded: false,
    });
}

async function expectStationItemStatus(
  request: APIRequestContext,
  auth: KdsAuthHeaders,
  station: Station,
  orderId: string,
  itemId: string,
  status: string,
): Promise<void> {
  await expect
    .poll(
      async () => ticketItemStatus(await getStationTickets(request, auth, station), orderId, itemId),
      {
        timeout: HANDOFF,
        message: `Expected ${station} KDS API item ${itemId} on order ${orderId} to be ${status}.`,
      },
    )
    .toBe(status);
}

async function expectNoPendingStationWork(
  request: APIRequestContext,
  auth: KdsAuthHeaders,
  station: Station,
  orderId: string,
): Promise<void> {
  await expect
    .poll(
      async () => ticketPendingItemIds(await getStationTickets(request, auth, station), orderId),
      {
        timeout: HANDOFF,
        message: `Expected ${station} KDS API to have no SENT/PREPARING work for order ${orderId}.`,
      },
    )
    .toEqual([]);
}

async function markKdsItemReady(
  request: APIRequestContext,
  auth: KdsAuthHeaders,
  orderId: string,
  itemId: string,
): Promise<OrderResponse> {
  const response = await request.post(
    `${ENV.apiBaseUrl}/kds/order-items/${encodeURIComponent(itemId)}/ready`,
    {
      headers: auth,
      failOnStatusCode: false,
      ignoreHTTPSErrors: true,
    },
  );
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(
      `POST /kds/order-items/${itemId}/ready for order ${orderId} failed: ${response.status()} ${text}`,
    );
  }

  return parseJsonBody<OrderResponse>(text, `POST /kds/order-items/${itemId}/ready`);
}

async function expectStationBoardContainsOnlyItem(input: {
  browser: Parameters<typeof openActor>[0];
  storageState: BrowserContextOptions['storageState'];
  kdsHome: string;
  deviceSecret: string;
  surface: string;
  station: Station;
  orderId: string;
  expectedItemId: string;
  excludedItemId: string;
}): Promise<void> {
  let kds: Actor | undefined;
  try {
    kds = await openActor(input.browser, 'kds', {
      artifactsDir: ARTIFACTS,
      baseURL: input.kdsHome,
      storageState: input.storageState,
    });

    await kds.page.goto(input.kdsHome, { waitUntil: 'domcontentloaded' });
    await seedKdsDeviceSecret(kds.page, input.deviceSecret, input.surface);
    await kds.page.reload({ waitUntil: 'domcontentloaded' });

    await expect(
      kds.page.getByTestId('kds-board'),
      [`KDS ${input.station} board did not render.`, `order id: ${input.orderId}`].join('\n'),
    ).toBeVisible({ timeout: HANDOFF });

    const ticket = kds.page.locator(
      `[data-testid="kds-ticket"][data-order-id="${input.orderId}"]`,
    );
    await expect(
      ticket,
      [
        `KDS ${input.station} board did not show ticket for order ${input.orderId}.`,
        `expected item id: ${input.expectedItemId}`,
        `excluded item id: ${input.excludedItemId}`,
        await kdsDiagnostics(kds.page),
      ].join('\n'),
    ).toBeVisible({ timeout: HANDOFF });

    await expect(
      ticket.locator(`[data-testid="kds-item"][data-order-item-id="${input.expectedItemId}"]`),
      `KDS ${input.station} board did not show station item ${input.expectedItemId}.`,
    ).toBeVisible({ timeout: HANDOFF });

    await expect(
      ticket.locator(`[data-testid="kds-item"][data-order-item-id="${input.excludedItemId}"]`),
      `KDS ${input.station} board showed other-station item ${input.excludedItemId}.`,
    ).toHaveCount(0);
  } finally {
    if (kds) await closeActor(kds, ARTIFACTS);
  }
}

test.describe('KDS multi-station completion', () => {
  test('does not mark parent order ready until all station items are ready', async ({
    browser,
    request,
  }) => {
    const fixture = readFixtures() as KdsMultiStationFixture;
    const fixtureData = requireCustomerOrderRequestFixture(fixture);
    requireKdsMultiStationFixture(fixture);

    await expectFrontendReachable(request, 'KDS on display PC', ENV.kdsBaseUrl);
    await expectApiHealth(request, { label: 'primary API for KDS multi-station completion' });

    const cleanupAuth = await seededOwnerAuthHeaders(request, fixture);
    await cancelActiveOrdersForSeededTable(
      request,
      cleanupAuth,
      fixtureData,
      'E2E kds-multi-station-completion setup cleanup',
    );

    let order: OrderResponse | undefined;

    try {
      const posSession = await buildPosSession();
      const posAuth = posAuthHeaders(posSession);
      const kdsSession = await buildKdsSession();
      expect(kdsSession.kds.station, 'KDS session station must match seeded fixture.').toBe(
        KITCHEN_STATION,
      );
      const kdsAuth = kdsAuthHeaders(kdsSession);

      const menuItems = flattenMenuItems(await getMenuTree(request, posAuth));
      const barItem = requireAvailableBarItem(menuItems);

      order = await createDineInOrder(request, posAuth, fixtureData.tableId);
      await addOrderItem(request, posAuth, order.id, {
        menuItemId: fixtureData.dishId,
        quantity: 1,
        selectedOptionIds: fixtureData.modifierOptionIds,
      });
      await addOrderItem(request, posAuth, order.id, {
        menuItemId: barItem.id,
        quantity: 1,
      });

      const sentOrder = await sendOrderToKitchen(request, posAuth, order.id);
      order =
        sentOrder.items && sentOrder.items.length > 0
          ? sentOrder
          : await getOrder(request, posAuth, order.id);
      expect(order.status, `Order ${order.id} was not sent to KDS.`).toBe('SENT_TO_KITCHEN');

      const kitchenOrderItem = requireOrderItem(order, {
        menuItemId: fixtureData.dishId,
        station: KITCHEN_STATION,
        label: 'KITCHEN',
      });
      const barOrderItem = requireOrderItem(order, {
        menuItemId: barItem.id,
        station: BAR_STATION,
        label: 'BAR',
      });
      expect(kitchenOrderItem.status, `Kitchen item ${kitchenOrderItem.id} should be SENT.`).toBe(
        'SENT',
      );
      expect(barOrderItem.status, `BAR item ${barOrderItem.id} should be SENT.`).toBe('SENT');

      await expectStationTicketContainsOnlyItem(
        request,
        kdsAuth,
        KITCHEN_STATION,
        order.id,
        kitchenOrderItem.id,
        barOrderItem.id,
      );
      await expectStationTicketContainsOnlyItem(
        request,
        kdsAuth,
        BAR_STATION,
        order.id,
        barOrderItem.id,
        kitchenOrderItem.id,
      );

      await expectStationBoardContainsOnlyItem({
        browser,
        storageState: kdsSession.kds.storageState,
        kdsHome: kdsSession.kdsHome,
        deviceSecret: kdsSession.kds.deviceSecret,
        surface: kdsSession.kds.surface,
        station: KITCHEN_STATION,
        orderId: order.id,
        expectedItemId: kitchenOrderItem.id,
        excludedItemId: barOrderItem.id,
      });
      await expectStationBoardContainsOnlyItem({
        browser,
        storageState: storageStatePinnedToStation(kdsSession.kds.storageState, BAR_STATION),
        kdsHome: kdsSession.kdsHome,
        deviceSecret: kdsSession.kds.deviceSecret,
        surface: kdsSession.kds.surface,
        station: BAR_STATION,
        orderId: order.id,
        expectedItemId: barOrderItem.id,
        excludedItemId: kitchenOrderItem.id,
      });

      const afterKitchenReady = await markKdsItemReady(
        request,
        kdsAuth,
        order.id,
        kitchenOrderItem.id,
      );
      expect(
        afterKitchenReady.status,
        [
          'Completing only KITCHEN must not mark the full order READY/SERVED/CLOSED while BAR is still pending.',
          `order id: ${order.id}`,
          `kitchen item id: ${kitchenOrderItem.id}`,
          `bar item id: ${barOrderItem.id}`,
        ].join('\n'),
      ).toBe('PREPARING');
      requireOrderItemStatus(
        afterKitchenReady,
        kitchenOrderItem.id,
        'READY',
        `KITCHEN ready response for order ${order.id}`,
      );
      requireOrderItemStatus(
        afterKitchenReady,
        barOrderItem.id,
        'SENT',
        `KITCHEN ready response for order ${order.id}`,
      );

      await expectStationItemStatus(
        request,
        kdsAuth,
        KITCHEN_STATION,
        order.id,
        kitchenOrderItem.id,
        'READY',
      );
      await expectStationItemStatus(
        request,
        kdsAuth,
        BAR_STATION,
        order.id,
        barOrderItem.id,
        'SENT',
      );

      const fetchedAfterKitchenReady = await getOrder(request, posAuth, order.id);
      expect(
        fetchedAfterKitchenReady.status,
        `POS/order API should still show order ${order.id} waiting on remaining station work.`,
      ).toBe('PREPARING');
      requireOrderItemStatus(
        fetchedAfterKitchenReady,
        kitchenOrderItem.id,
        'READY',
        `Fetched order after KITCHEN ready for order ${order.id}`,
      );
      requireOrderItemStatus(
        fetchedAfterKitchenReady,
        barOrderItem.id,
        'SENT',
        `Fetched order after KITCHEN ready for order ${order.id}`,
      );

      const afterBarReady = await markKdsItemReady(request, kdsAuth, order.id, barOrderItem.id);
      expect(afterBarReady.status, `All station items ready should mark order ${order.id} READY.`).toBe(
        'READY',
      );
      requireOrderItemStatus(
        afterBarReady,
        kitchenOrderItem.id,
        'READY',
        `BAR ready response for order ${order.id}`,
      );
      requireOrderItemStatus(
        afterBarReady,
        barOrderItem.id,
        'READY',
        `BAR ready response for order ${order.id}`,
      );

      await expectStationItemStatus(
        request,
        kdsAuth,
        KITCHEN_STATION,
        order.id,
        kitchenOrderItem.id,
        'READY',
      );
      await expectStationItemStatus(
        request,
        kdsAuth,
        BAR_STATION,
        order.id,
        barOrderItem.id,
        'READY',
      );
      await expectNoPendingStationWork(request, kdsAuth, KITCHEN_STATION, order.id);
      await expectNoPendingStationWork(request, kdsAuth, BAR_STATION, order.id);

      const fetchedAfterAllReady = await getOrder(request, posAuth, order.id);
      expect(
        fetchedAfterAllReady.status,
        `POS/order API should show order ${order.id} READY after all stations complete.`,
      ).toBe('READY');
      requireOrderItemStatus(
        fetchedAfterAllReady,
        kitchenOrderItem.id,
        'READY',
        `Fetched order after all stations ready for order ${order.id}`,
      );
      requireOrderItemStatus(
        fetchedAfterAllReady,
        barOrderItem.id,
        'READY',
        `Fetched order after all stations ready for order ${order.id}`,
      );
    } finally {
      if (order?.id) {
        await cancelOrder(
          request,
          cleanupAuth,
          order.id,
          'E2E kds-multi-station-completion cleanup after assertions',
        ).catch(() => undefined);
      }
    }
  });
});
