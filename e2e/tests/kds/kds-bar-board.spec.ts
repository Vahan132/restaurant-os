import { test, expect, type APIRequestContext, type BrowserContextOptions, type Locator, type Page } from '@playwright/test';
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
   posAuthHeaders,
   requireCustomerOrderRequestFixture,
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

const ARTIFACTS = path.resolve(__dirname, '../../artifacts/actors-kds-bar-board');
const HANDOFF = 30_000;
const BAR_STATION = 'BAR';
const KITCHEN_STATION = 'KITCHEN';

type BrowserStorageState = Exclude<NonNullable<BrowserContextOptions['storageState']>, string>;

interface KdsBarBoardFixture extends CustomerOrderRequestFixture {
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
   fixture: KdsBarBoardFixture,
   actor: 'pos' | 'kds',
   fields: string[],
): void {
   const value = fixture[actor] as Record<string, unknown> | undefined;
   const missing = fields
      .filter((field) => typeof value?.[field] !== 'string' || String(value[field]).length === 0)
      .map((field) => `${actor}.${field}`);

   if (missing.length > 0) {
      throw new Error(
         `Invalid KDS BAR board E2E fixture: missing ${missing.join(', ')}.\n` +
         `fixture path: ${ENV.fixturesPath}\n` +
         'Run `pnpm db:seed` and then `pnpm db:seed:e2e` from the api workspace.',
      );
   }
}

function requireKdsBarBoardFixture(fixture: KdsBarBoardFixture): void {
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
         `Invalid KDS BAR board fixture: expected seeded kds.station to be KITCHEN, got ${fixture.kds?.station}.\n` +
         'This test intentionally overrides the browser-pinned station to BAR after login.',
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
   station: string,
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
            `BAR items: ${items
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
   input: { menuItemId: string; station: string; label: string },
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

function ticketForOrder(tickets: KdsTicketResponse[], orderId: string): KdsTicketResponse | null {
   return tickets.find((ticket) => ticket.orderId === orderId) ?? null;
}

function ticketContainsItem(
   tickets: KdsTicketResponse[],
   orderId: string,
   itemId: string,
): boolean {
   return (
      ticketForOrder(tickets, orderId)?.items.some((item) => item.orderItemId === itemId) ?? false
   );
}

function ticketItemIds(tickets: KdsTicketResponse[], orderId: string): string[] {
   return ticketForOrder(tickets, orderId)?.items.map((item) => item.orderItemId) ?? [];
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
      `visible KDS headings: ${(await visibleTexts(page.locator('h1:visible, h2:visible, h3:visible'))).join(' | ') ||
      '<none>'
      }`,
      `visible KDS buttons: ${(await visibleTexts(page.locator('button:visible'))).join(' | ') || '<none>'
      }`,
      `visible KDS alerts: ${(
         await visibleTexts(
            page.locator(
               '[role="alert"]:visible, .text-status-delayed:visible, .text-red-600:visible, .text-red-700:visible',
            ),
         )
      ).join(' | ') || '<none>'
      }`,
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
         'Could not clear active orders for seeded table before KDS BAR board test.',
         `table id/name: ${fixtureData.tableId} / ${fixtureData.tableName}`,
         `remaining order ids/statuses: ${remaining.map((order) => `${order.id}:${order.status ?? '<unknown>'}`).join(', ') ||
         '<none>'
         }`,
      ].join('\n'),
   ).toHaveLength(0);
}

async function expectStationTickets(
   request: APIRequestContext,
   auth: KdsAuthHeaders,
   station: 'KITCHEN' | 'BAR',
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
               includesExcluded: ticketContainsItem(tickets, orderId, excludedItemId),
               itemIds: ticketItemIds(tickets, orderId),
            };
         },
         {
            timeout: HANDOFF,
            message: `Expected ${station} KDS API ticket for order ${orderId} to include ${expectedItemId} and exclude ${excludedItemId}.`,
         },
      )
      .toMatchObject({
         includesExpected: true,
         includesExcluded: false,
      });
}

test.describe('KDS BAR board', () => {
   let kds: Actor | undefined;

   test.afterEach(async () => {
      if (kds) {
         await closeActor(kds, ARTIFACTS);
         kds = undefined;
      }
   });

   test('shows BAR item on the BAR board and hides KITCHEN item from that ticket', async ({
      browser,
      request,
   }) => {
      const fixture = readFixtures() as KdsBarBoardFixture;
      const fixtureData = requireCustomerOrderRequestFixture(fixture);
      requireKdsBarBoardFixture(fixture);

      await expectFrontendReachable(request, 'KDS on display PC', ENV.kdsBaseUrl);
      await expectApiHealth(request, { label: 'primary API for KDS BAR board test' });

      const cleanupAuth = await seededOwnerAuthHeaders(request, fixture);
      await cancelActiveOrdersForSeededTable(
         request,
         cleanupAuth,
         fixtureData,
         'E2E kds-bar-board setup cleanup',
      );

      let order: OrderResponse | undefined;

      try {
         const posSession = await buildPosSession();
         const posAuth = posAuthHeaders(posSession);
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

         const kdsSession = await buildKdsSession();
         const kdsAuth = kdsAuthHeaders(kdsSession);

         await expectStationTickets(
            request,
            kdsAuth,
            'KITCHEN',
            order.id,
            kitchenOrderItem.id,
            barOrderItem.id,
         );

         await expectStationTickets(
            request,
            kdsAuth,
            'BAR',
            order.id,
            barOrderItem.id,
            kitchenOrderItem.id,
         );

         kds = await openActor(browser, 'kds', {
            artifactsDir: ARTIFACTS,
            baseURL: kdsSession.kdsHome,
            storageState: storageStatePinnedToStation(kdsSession.kds.storageState, BAR_STATION),
         });

         await kds.page.goto(kdsSession.kdsHome, { waitUntil: 'domcontentloaded' });
         await seedKdsDeviceSecret(kds.page, kdsSession.kds.deviceSecret, kdsSession.kds.surface);
         await kds.page.reload({ waitUntil: 'domcontentloaded' });

         await expect(
            kds.page.getByTestId('kds-board'),
            [
               'KDS BAR board did not render.',
               `order id: ${order.id}`,
               `bar item id: ${barOrderItem.id}`,
               await kdsDiagnostics(kds.page),
            ].join('\n'),
         ).toBeVisible({ timeout: HANDOFF });

         const ticket = kds.page.locator(
            `[data-testid="kds-ticket"][data-order-id="${order.id}"]`,
         );

         await expect(
            ticket,
            [
               `KDS BAR board did not show ticket for order ${order.id}.`,
               `table id/name: ${fixtureData.tableId} / ${fixtureData.tableName}`,
               `bar item id/name: ${barOrderItem.id} / ${barItem.name}`,
               `kitchen item id: ${kitchenOrderItem.id}`,
               await kdsDiagnostics(kds.page),
            ].join('\n'),
         ).toBeVisible({ timeout: HANDOFF });

         await expect(
            ticket.locator(`[data-testid="kds-item"][data-order-item-id="${barOrderItem.id}"]`),
            `KDS BAR board did not show BAR item ${barOrderItem.id} (${barItem.name}).`,
         ).toBeVisible({ timeout: HANDOFF });

         await expect(
            ticket.locator(`[data-testid="kds-item"][data-order-item-id="${kitchenOrderItem.id}"]`),
            `KDS BAR board showed KITCHEN item ${kitchenOrderItem.id}.`,
         ).toHaveCount(0);
      } finally {
         if (order?.id) {
            await cancelOrder(
               request,
               cleanupAuth,
               order.id,
               'E2E kds-bar-board cleanup after BAR board assertions',
            ).catch(() => undefined);
         }
      }
   });
});