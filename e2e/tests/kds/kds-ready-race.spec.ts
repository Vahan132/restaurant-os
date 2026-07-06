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
   getStationTickets,
   getTable,
   kdsAuthHeaders,
   listActiveOrdersForTable,
   listFloors,
   listTables,
   parseJsonBody,
   posAuthHeaders,
   requireCustomerOrderRequestFixture,
   responseBodyText,
   seededOwnerAuthHeaders,
   sendOrderToKitchen,
   type CustomerOrderRequestFixture,
   type KdsAuthHeaders,
   type KdsTicketResponse,
   type OrderItemResponse,
   type OrderResponse,
   type PosAuthHeaders,
   type TableResponse,
} from '../../helpers/order-requests';
import { buildKdsSession, buildPosSession, readFixtures } from '../../helpers/session';

const KDS_READY_RACE_TABLE = {
   name: 'E2E KDS Ready Race',
   qrIdentifier: 'e2e-kds-ready-race',
} as const;

const KITCHEN_STATION = 'KITCHEN';
const HANDOFF = 30_000;

interface RequestResult {
   status: number;
   ok: boolean;
   text: string;
}

interface ApiErrorBody {
   error?: {
      code?: string;
      message?: string;
   };
   code?: string;
   message?: string;
}

function errorCode(text: string): string | undefined {
   try {
      const body = parseJsonBody<ApiErrorBody>(text, 'KDS race response');
      return body.error?.code ?? body.code;
   } catch {
      return undefined;
   }
}

function requireKitchenOrderItem(order: OrderResponse, menuItemId: string): OrderItemResponse {
   const candidates = (order.items ?? []).filter(
      (item) => item.menuItemId === menuItemId && item.preparationStation === KITCHEN_STATION,
   );

   if (candidates.length !== 1) {
      throw new Error(
         [
            'Could not identify exactly one KITCHEN order item for KDS ready race.',
            `order id: ${order.id}`,
            `menu item id: ${menuItemId}`,
            `matching item ids: ${candidates.map((item) => item.id).join(', ') || '<none>'}`,
            `order items: ${JSON.stringify(order.items ?? [])}`,
         ].join('\n'),
      );
   }

   return candidates[0];
}

function orderItemStatus(order: OrderResponse, itemId: string): string | null {
   return order.items?.find((item) => item.id === itemId)?.status ?? null;
}

function ticketForOrder(tickets: KdsTicketResponse[], orderId: string): KdsTicketResponse | null {
   return tickets.find((ticket) => ticket.orderId === orderId) ?? null;
}

function stationItemStatus(
   tickets: KdsTicketResponse[],
   orderId: string,
   itemId: string,
): string | null {
   return (
      ticketForOrder(tickets, orderId)?.items.find((item) => item.orderItemId === itemId)?.status ??
      null
   );
}

function stationItemOccurrences(
   tickets: KdsTicketResponse[],
   orderId: string,
   itemId: string,
): number {
   return (
      ticketForOrder(tickets, orderId)?.items.filter((item) => item.orderItemId === itemId).length ??
      0
   );
}

function pendingStationItemIds(tickets: KdsTicketResponse[], orderId: string): string[] {
   return (
      ticketForOrder(tickets, orderId)?.items
         .filter((item) => item.status !== 'READY')
         .map((item) => item.orderItemId) ?? []
   );
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

async function markKdsItemPreparingRaw(
   request: APIRequestContext,
   auth: KdsAuthHeaders,
   itemId: string,
): Promise<RequestResult> {
   return requestText(
      request,
      'post',
      `${ENV.apiBaseUrl}/kds/order-items/${encodeURIComponent(itemId)}/preparing`,
      { headers: auth },
   );
}

async function markKdsItemReadyRaw(
   request: APIRequestContext,
   auth: KdsAuthHeaders,
   itemId: string,
): Promise<RequestResult> {
   return requestText(
      request,
      'post',
      `${ENV.apiBaseUrl}/kds/order-items/${encodeURIComponent(itemId)}/ready`,
      { headers: auth },
   );
}

async function expectStationItemStatus(
   request: APIRequestContext,
   auth: KdsAuthHeaders,
   orderId: string,
   itemId: string,
   expectedStatus: string,
): Promise<void> {
   await expect
      .poll(
         async () => {
            const tickets = await getStationTickets(request, auth, KITCHEN_STATION);
            return stationItemStatus(tickets, orderId, itemId);
         },
         {
            timeout: HANDOFF,
            message: `Expected KDS item ${itemId} on order ${orderId} to become ${expectedStatus}.`,
         },
      )
      .toBe(expectedStatus);
}

async function ensureKdsReadyRaceTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
): Promise<TableResponse> {
   const existing = (await listTables(request, auth)).find(
      (table) =>
         table.qrIdentifier === KDS_READY_RACE_TABLE.qrIdentifier ||
         table.name === KDS_READY_RACE_TABLE.name,
   );

   if (existing) return existing;

   const floors = await listFloors(request, auth);
   const floor = floors.find((candidate) => candidate.status === 'ACTIVE') ?? floors[0];

   if (!floor) {
      throw new Error('Cannot create KDS ready-race E2E table: GET /floors returned no floors.');
   }

   return createTable(request, auth, {
      floorId: floor.id,
      name: KDS_READY_RACE_TABLE.name,
      seatCapacity: 4,
      qrIdentifier: KDS_READY_RACE_TABLE.qrIdentifier,
   });
}

async function resetKdsReadyRaceTable(
   request: APIRequestContext,
   auth: PosAuthHeaders,
   table: TableResponse,
): Promise<TableResponse> {
   const activeOrders = await listActiveOrdersForTable(request, auth, table.id);

   for (const order of activeOrders) {
      await cancelOrder(request, auth, order.id, 'E2E kds-ready-race setup cleanup').catch(
         () => undefined,
      );
   }

   const remainingOrders = await listActiveOrdersForTable(request, auth, table.id);
   expect(
      remainingOrders,
      [
         'KDS ready-race setup could not clear active orders.',
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

test.describe('KDS ready race', () => {
   test('handles concurrent ready actions for the same KDS item without duplicate state', async ({
      request,
   }) => {
      const fixture = readFixtures() as CustomerOrderRequestFixture;
      const fixtureData = requireCustomerOrderRequestFixture(fixture);

      await expectApiHealth(request, { label: 'primary API for KDS ready race' });

      const cleanupAuth = await seededOwnerAuthHeaders(request, fixture);
      const table = await resetKdsReadyRaceTable(
         request,
         cleanupAuth,
         await ensureKdsReadyRaceTable(request, cleanupAuth),
      );

      let orderId: string | undefined;

      try {
         const posSession = await buildPosSession();
         const posAuth = posAuthHeaders(posSession);

         const kdsSession = await buildKdsSession();
         expect(kdsSession.kds.station, 'KDS session station must be KITCHEN for this race test.').toBe(
            KITCHEN_STATION,
         );
         const kdsAuth = kdsAuthHeaders(kdsSession);

         const created = await createDineInOrder(request, posAuth, table.id);
         orderId = created.id;

         await addOrderItem(request, posAuth, created.id, {
            menuItemId: fixtureData.dishId,
            quantity: 1,
            selectedOptionIds: fixtureData.modifierOptionIds,
         });

         const sent = await sendOrderToKitchen(request, posAuth, created.id);
         const sentOrder =
            sent.items && sent.items.length > 0 ? sent : await getOrder(request, posAuth, created.id);

         expect(sentOrder.status, `Order ${created.id} should be sent to kitchen.`).toBe(
            'SENT_TO_KITCHEN',
         );

         const kitchenItem = requireKitchenOrderItem(sentOrder, fixtureData.dishId);
         expect(kitchenItem.status, `Kitchen item ${kitchenItem.id} should start SENT.`).toBe('SENT');

         await expectStationItemStatus(
            request,
            kdsAuth,
            sentOrder.id,
            kitchenItem.id,
            'SENT',
         );

         const preparing = await markKdsItemPreparingRaw(request, kdsAuth, kitchenItem.id);

         expect(
            preparing.ok,
            [
               'Preparing KDS item before ready race should succeed.',
               `status: ${preparing.status}`,
               `body: ${preparing.text}`,
               `order id: ${sentOrder.id}`,
               `item id: ${kitchenItem.id}`,
            ].join('\n'),
         ).toBeTruthy();

         const preparingOrder = parseJsonBody<OrderResponse>(
            preparing.text,
            `POST /kds/order-items/${kitchenItem.id}/preparing`,
         );
         expect(
            orderItemStatus(preparingOrder, kitchenItem.id),
            `Preparing response should mark item ${kitchenItem.id} PREPARING.`,
         ).toBe('PREPARING');

         await expectStationItemStatus(
            request,
            kdsAuth,
            sentOrder.id,
            kitchenItem.id,
            'PREPARING',
         );

         const [firstReady, secondReady] = await Promise.all([
            markKdsItemReadyRaw(request, kdsAuth, kitchenItem.id),
            markKdsItemReadyRaw(request, kdsAuth, kitchenItem.id),
         ]);

         const results = [firstReady, secondReady];
         const successful = results.filter((result) => result.ok);
         const failed = results.filter((result) => !result.ok);
         const serverFailures = failed.filter((result) => result.status >= 500);

         expect(
            successful.length,
            [
               'At least one concurrent ready request should succeed.',
               `results: ${JSON.stringify(
                  results.map((result) => ({
                     status: result.status,
                     ok: result.ok,
                     code: result.ok ? undefined : errorCode(result.text),
                     body: result.text,
                  })),
               )}`,
               `order id: ${sentOrder.id}`,
               `item id: ${kitchenItem.id}`,
            ].join('\n'),
         ).toBeGreaterThan(0);

         expect(
            serverFailures,
            [
               'Concurrent KDS ready requests should not produce backend 5xx errors.',
               `results: ${JSON.stringify(
                  results.map((result) => ({
                     status: result.status,
                     ok: result.ok,
                     code: result.ok ? undefined : errorCode(result.text),
                     body: result.text,
                  })),
               )}`,
            ].join('\n'),
         ).toHaveLength(0);

         for (const result of failed) {
            expect(
               [400, 404, 409],
               [
                  'Second/duplicate ready request should fail safely if it is not idempotent.',
                  `status: ${result.status}`,
                  `body: ${result.text}`,
                  `code: ${errorCode(result.text) ?? '<none>'}`,
               ].join('\n'),
            ).toContain(result.status);
         }

         const finalOrder = await expect
            .poll(
               async () => {
                  const current = await getOrder(request, posAuth, sentOrder.id);
                  return {
                     orderStatus: current.status,
                     itemStatus: orderItemStatus(current, kitchenItem.id),
                  };
               },
               {
                  timeout: HANDOFF,
                  message: `Expected order ${sentOrder.id} and item ${kitchenItem.id} to settle after ready race.`,
               },
            )
            .toEqual({
               orderStatus: 'READY',
               itemStatus: 'READY',
            });

         // Keep TypeScript happy that the poll above is intentionally awaited for assertions.
         void finalOrder;

         const ticketsAfterRace = await getStationTickets(request, kdsAuth, KITCHEN_STATION);
         expect(
            stationItemOccurrences(ticketsAfterRace, sentOrder.id, kitchenItem.id),
            [
               'KDS ready race should not create duplicate KDS ticket items.',
               `order id: ${sentOrder.id}`,
               `item id: ${kitchenItem.id}`,
               `tickets: ${JSON.stringify(ticketsAfterRace)}`,
            ].join('\n'),
         ).toBe(1);

         expect(
            stationItemStatus(ticketsAfterRace, sentOrder.id, kitchenItem.id),
            `KDS item ${kitchenItem.id} should end READY after race.`,
         ).toBe('READY');

         expect(
            pendingStationItemIds(ticketsAfterRace, sentOrder.id),
            `KDS should have no pending KITCHEN work left for order ${sentOrder.id}.`,
         ).toEqual([]);

         const tableAfterRace = await getTable(request, posAuth, table.id);
         expect(tableAfterRace.status, `Table ${table.id} should remain OCCUPIED after KDS ready.`).toBe(
            'OCCUPIED',
         );
      } finally {
         if (orderId) {
            await cancelOrder(request, cleanupAuth, orderId, 'E2E kds-ready-race cleanup').catch(
               () => undefined,
            );
         }

         await resetKdsReadyRaceTable(request, cleanupAuth, table).catch(() => undefined);
      }
   });
});