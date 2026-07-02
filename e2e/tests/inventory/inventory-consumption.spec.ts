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
  getTable,
  listActiveOrdersForTable,
  listFloors,
  listTables,
  parseJsonBody,
  requireCustomerOrderRequestFixture,
  responseBodyText,
  sendOrderToKitchen,
  markOrderServed,
  type CustomerOrderRequestFixture,
  type OrderResponse,
  type PosAuthHeaders,
  type TableResponse,
} from '../../helpers/order-requests';
import { readFixtures } from '../../helpers/session';

const STAFF_PASSWORD = 'ChangeMe123!';
const INVENTORY_TABLE_NAME = 'E2E Inventory Consumption';
const INVENTORY_TABLE_QR = 'e2e-inventory-consumption';

interface LoginResponse {
  accessToken: string;
  user: { id: string; email: string; fullName: string };
}

interface ApiList<T> {
  data: T[];
}

interface RecipeListItemResponse {
  id: string;
  menuItemId: string;
  lineCount: number;
}

interface RecipeResponse {
  id: string;
  menuItemId: string;
  lines: Array<{ id: string; itemId: string; baseQty: number }>;
  modifierConsumptions: Array<{ id: string; modifierOptionId: string; itemId: string; baseQty: number }>;
}

interface InventoryItemResponse {
  id: string;
  name: string;
  sku: string | null;
  baseUnit: string;
  consumptionLocationId: string | null;
}

interface StockOnHandRowResponse {
  branchId: string;
  locationId: string;
  locationName: string;
  itemId: string;
  itemName: string;
  baseUnit: string;
  quantity: number;
}

interface StockMovementResponse {
  id: string;
  branchId: string;
  locationId: string;
  itemId: string;
  type: string;
  baseQty: number;
  refType: string | null;
  refId: string | null;
  occurredAt: string;
}

interface IngredientExpectation {
  item: InventoryItemResponse;
  locationId: string;
  locationName: string;
  expectedQty: number;
  initialQty: number;
  afterAddQty: number;
  afterSendQty: number;
  afterServeQty: number;
  afterCancelQty: number;
  consumptionMovements: StockMovementResponse[];
  reversalMovements: StockMovementResponse[];
}

function authHeaders(accessToken: string, branchId: string): PosAuthHeaders {
  return {
    authorization: `Bearer ${accessToken}`,
    'x-branch-id': branchId,
    'content-type': 'application/json',
  };
}

function parseListResponse<T>(text: string, context: string): T[] {
  const body = parseJsonBody<unknown>(text, context);
  if (Array.isArray(body)) return body as T[];
  if (
    body &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    Array.isArray((body as { data?: unknown }).data)
  ) {
    return (body as { data: T[] }).data;
  }
  throw new Error(`${context} returned an unexpected list shape: ${text}`);
}

async function requestText(
  request: APIRequestContext,
  method: 'get' | 'post' | 'patch',
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

async function loginOwner(request: APIRequestContext): Promise<LoginResponse> {
  const response = await requestText(request, 'post', `${ENV.apiBaseUrl}/auth/login`, {
    headers: { 'content-type': 'application/json' },
    data: {
      email: 'owner@tavern-ararat.am',
      password: STAFF_PASSWORD,
    },
  });
  if (!response.ok) {
    throw new Error(`POST /auth/login owner failed: ${response.status} ${response.text}`);
  }
  return parseJsonBody<LoginResponse>(response.text, 'POST /auth/login owner');
}

async function ensureInventoryTable(
  request: APIRequestContext,
  auth: PosAuthHeaders,
): Promise<TableResponse> {
  const existing = (await listTables(request, auth)).find(
    (table) => table.qrIdentifier === INVENTORY_TABLE_QR || table.name === INVENTORY_TABLE_NAME,
  );
  if (existing) return existing;

  const floors = await listFloors(request, auth);
  const floor = floors.find((candidate) => candidate.status === 'ACTIVE') ?? floors[0];
  if (!floor) {
    throw new Error('Cannot create inventory-consumption table: GET /floors returned no floors.');
  }

  return createTable(request, auth, {
    floorId: floor.id,
    name: INVENTORY_TABLE_NAME,
    seatCapacity: 2,
    qrIdentifier: INVENTORY_TABLE_QR,
  });
}

async function resetOrderTable(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  table: TableResponse,
): Promise<TableResponse> {
  const activeOrders = await listActiveOrdersForTable(request, auth, table.id);
  for (const order of activeOrders) {
    await cancelOrder(request, auth, order.id, 'E2E inventory consumption setup cleanup');
  }

  const remaining = await listActiveOrdersForTable(request, auth, table.id);
  expect(
    remaining,
    `Inventory-consumption setup could not clear active orders for table ${table.id}.`,
  ).toHaveLength(0);

  const current = await getTable(request, auth, table.id);
  if (current.status === 'CLEANING' || current.status === 'DISABLED') {
    return changeTableStatus(request, auth, table.id, 'AVAILABLE');
  }
  return current;
}

async function getRecipeForMenuItem(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  menuItemId: string,
): Promise<RecipeResponse> {
  const params = new URLSearchParams({ menuItemId, limit: '5' });
  const list = await requestText(request, 'get', `${ENV.apiBaseUrl}/inventory/recipes?${params}`, {
    headers: auth,
  });
  if (!list.ok) {
    throw new Error(`GET /inventory/recipes?${params} failed: ${list.status} ${list.text}`);
  }
  const recipes = parseJsonBody<ApiList<RecipeListItemResponse>>(
    list.text,
    `GET /inventory/recipes?${params}`,
  ).data;
  expect(recipes, `Expected exactly one seeded recipe for menu item ${menuItemId}.`).toHaveLength(1);
  expect(recipes[0].lineCount, `Seeded recipe for menu item ${menuItemId} should have lines.`).toBeGreaterThan(0);

  const detail = await requestText(
    request,
    'get',
    `${ENV.apiBaseUrl}/inventory/recipes/${encodeURIComponent(recipes[0].id)}`,
    { headers: auth },
  );
  if (!detail.ok) {
    throw new Error(`GET /inventory/recipes/${recipes[0].id} failed: ${detail.status} ${detail.text}`);
  }
  return parseJsonBody<RecipeResponse>(detail.text, `GET /inventory/recipes/${recipes[0].id}`);
}

async function getInventoryItem(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  itemId: string,
): Promise<InventoryItemResponse> {
  const response = await requestText(
    request,
    'get',
    `${ENV.apiBaseUrl}/inventory/items/${encodeURIComponent(itemId)}`,
    { headers: auth },
  );
  if (!response.ok) {
    throw new Error(`GET /inventory/items/${itemId} failed: ${response.status} ${response.text}`);
  }
  return parseJsonBody<InventoryItemResponse>(response.text, `GET /inventory/items/${itemId}`);
}

async function getOnHandRows(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  input: { branchId: string; itemId: string },
): Promise<StockOnHandRowResponse[]> {
  const params = new URLSearchParams({
    branchId: input.branchId,
    itemId: input.itemId,
    limit: '100',
  });
  const response = await requestText(
    request,
    'get',
    `${ENV.apiBaseUrl}/inventory/reports/stock-on-hand?${params}`,
    { headers: auth },
  );
  if (!response.ok) {
    throw new Error(`GET /inventory/reports/stock-on-hand?${params} failed: ${response.status} ${response.text}`);
  }
  return parseJsonBody<ApiList<StockOnHandRowResponse>>(
    response.text,
    `GET /inventory/reports/stock-on-hand?${params}`,
  ).data;
}

async function getOnHandAtConsumptionLocation(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  input: { branchId: string; item: InventoryItemResponse },
): Promise<StockOnHandRowResponse> {
  const rows = await getOnHandRows(request, auth, { branchId: input.branchId, itemId: input.item.id });
  const row = input.item.consumptionLocationId
    ? rows.find((candidate) => candidate.locationId === input.item.consumptionLocationId)
    : rows[0];
  if (!row) {
    throw new Error(
      `No stock-on-hand row found for item ${input.item.id} at its consumption location ${input.item.consumptionLocationId ?? '<default>'}.`,
    );
  }
  return row;
}

async function getItemMovements(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  input: { branchId: string; itemId: string; type?: string },
): Promise<StockMovementResponse[]> {
  const params = new URLSearchParams({
    branchId: input.branchId,
    itemId: input.itemId,
    limit: '100',
  });
  if (input.type) {
    params.set('type', input.type);
  }
  const response = await requestText(
    request,
    'get',
    `${ENV.apiBaseUrl}/inventory/reports/movements?${params}`,
    { headers: auth },
  );
  if (!response.ok) {
    throw new Error(`GET /inventory/reports/movements?${params} failed: ${response.status} ${response.text}`);
  }
  return parseJsonBody<ApiList<StockMovementResponse>>(
    response.text,
    `GET /inventory/reports/movements?${params}`,
  ).data;
}

function expectedConsumptionByItem(recipe: RecipeResponse, selectedOptionIds: string[]): Map<string, number> {
  const selected = new Set(selectedOptionIds);
  const expected = new Map<string, number>();
  for (const line of recipe.lines) {
    expected.set(line.itemId, (expected.get(line.itemId) ?? 0) + line.baseQty);
  }
  for (const modifier of recipe.modifierConsumptions) {
    if (selected.has(modifier.modifierOptionId)) {
      expected.set(modifier.itemId, (expected.get(modifier.itemId) ?? 0) + modifier.baseQty);
    }
  }
  return expected;
}

function orderItemForMenuItem(order: OrderResponse, menuItemId: string) {
  const item = order.items?.find((candidate) => candidate.menuItemId === menuItemId);
  if (!item) {
    throw new Error(`Order ${order.id} did not contain menu item ${menuItemId}.`);
  }
  return item;
}

test.describe('inventory consumption', () => {
  test('decreases stock exactly once when a recipe-backed order item is sent to kitchen', async ({
    request,
  }) => {
    const fixture = readFixtures() as CustomerOrderRequestFixture;
    const branchId = fixture.branch?.id;
    if (!branchId) {
      throw new Error('Invalid E2E fixture: missing branch.id.');
    }
    const dish = requireCustomerOrderRequestFixture(fixture);

    await expectApiHealth(request, { label: 'primary API for inventory consumption' });

    const owner = await loginOwner(request);
    const auth = authHeaders(owner.accessToken, branchId);
    const table = await resetOrderTable(request, auth, await ensureInventoryTable(request, auth));

    let orderId: string | undefined;
    let orderWasCancelled = false;

    try {
      const recipe = await getRecipeForMenuItem(request, auth, dish.dishId);
      const expectedByItem = expectedConsumptionByItem(recipe, dish.modifierOptionIds);
      expect(expectedByItem.size, `Recipe ${recipe.id} should consume at least one ingredient.`).toBeGreaterThan(0);

      const ingredients: IngredientExpectation[] = [];
      for (const [itemId, expectedQty] of expectedByItem) {
        const item = await getInventoryItem(request, auth, itemId);
        const initial = await getOnHandAtConsumptionLocation(request, auth, { branchId, item });
        expect(
          initial.quantity,
          `Ingredient ${item.name} should have enough stock for this isolated test order.`,
        ).toBeGreaterThanOrEqual(expectedQty);
        ingredients.push({
          item,
          locationId: initial.locationId,
          locationName: initial.locationName,
          expectedQty,
          initialQty: initial.quantity,
          afterAddQty: NaN,
          afterSendQty: NaN,
          afterServeQty: NaN,
          afterCancelQty: NaN,
          consumptionMovements: [],
          reversalMovements: [],
        });
      }

      const created = await createDineInOrder(request, auth, table.id);
      orderId = created.id;
      const afterAdd = await addOrderItem(request, auth, created.id, {
        menuItemId: dish.dishId,
        quantity: 1,
        selectedOptionIds: dish.modifierOptionIds,
      });
      const orderItem = orderItemForMenuItem(afterAdd, dish.dishId);
      expect(orderItem.status, `New order item ${orderItem.id} should not be sent yet.`).toBe('NEW');

      for (const ingredient of ingredients) {
        const row = await getOnHandAtConsumptionLocation(request, auth, { branchId, item: ingredient.item });
        ingredient.afterAddQty = row.quantity;
        expect(
          ingredient.afterAddQty,
          `Stock for ${ingredient.item.name} should not change when an item is merely added to a draft order.`,
        ).toBe(ingredient.initialQty);

        const prematureMovements = (await getItemMovements(request, auth, {
          branchId,
          itemId: ingredient.item.id,
          type: 'CONSUMPTION_OUT',
        })).filter((movement) => movement.refType === 'ORDER_LINE' && movement.refId === orderItem.id);
        expect(
          prematureMovements,
          `No CONSUMPTION_OUT movement should exist for ${ingredient.item.name} before send-to-kitchen.`,
        ).toHaveLength(0);
      }

      const sent = await sendOrderToKitchen(request, auth, created.id);
      const sentOrderItem = orderItemForMenuItem(sent, dish.dishId);
      expect(sentOrderItem.id, 'Send-to-kitchen should keep the same order item id.').toBe(orderItem.id);
      expect(sentOrderItem.status, `Order item ${orderItem.id} should be sent to kitchen.`).toBe('SENT');

      for (const ingredient of ingredients) {
        const row = await getOnHandAtConsumptionLocation(request, auth, { branchId, item: ingredient.item });
        ingredient.afterSendQty = row.quantity;
        expect(
          ingredient.initialQty - ingredient.afterSendQty,
          `Send-to-kitchen should consume the exact recipe quantity for ${ingredient.item.name}.`,
        ).toBe(ingredient.expectedQty);

        ingredient.consumptionMovements = (await getItemMovements(request, auth, {
          branchId,
          itemId: ingredient.item.id,
          type: 'CONSUMPTION_OUT',
        })).filter((movement) => movement.refType === 'ORDER_LINE' && movement.refId === orderItem.id);
        expect(
          ingredient.consumptionMovements,
          `Exactly one CONSUMPTION_OUT movement should be recorded for ${ingredient.item.name}.`,
        ).toHaveLength(1);
        expect(
          ingredient.consumptionMovements[0].baseQty,
          `CONSUMPTION_OUT movement should match ${ingredient.item.name} recipe quantity with a negative sign.`,
        ).toBe(-ingredient.expectedQty);
      }

      const served = await markOrderServed(request, auth, created.id);
      expect(served.status, `Order ${created.id} should be SERVED.`).toBe('SERVED');

      for (const ingredient of ingredients) {
        const row = await getOnHandAtConsumptionLocation(request, auth, { branchId, item: ingredient.item });
        ingredient.afterServeQty = row.quantity;
        expect(
          ingredient.afterServeQty,
          `Serving should not deduct ${ingredient.item.name} a second time.`,
        ).toBe(ingredient.afterSendQty);

        const movementsAfterServe = (await getItemMovements(request, auth, {
          branchId,
          itemId: ingredient.item.id,
          type: 'CONSUMPTION_OUT',
        })).filter((movement) => movement.refType === 'ORDER_LINE' && movement.refId === orderItem.id);
        expect(
          movementsAfterServe,
          `Serving should not create duplicate CONSUMPTION_OUT movements for ${ingredient.item.name}.`,
        ).toHaveLength(1);
      }

      await cancelOrder(request, auth, created.id, 'E2E inventory consumption restores stock');
      orderWasCancelled = true;

      for (const ingredient of ingredients) {
        const row = await getOnHandAtConsumptionLocation(request, auth, { branchId, item: ingredient.item });
        ingredient.afterCancelQty = row.quantity;
        expect(
          ingredient.afterCancelQty,
          `Cancelling the test order should restore ${ingredient.item.name} stock to its initial quantity.`,
        ).toBe(ingredient.initialQty);

        ingredient.reversalMovements = (await getItemMovements(request, auth, {
          branchId,
          itemId: ingredient.item.id,
          type: 'CONSUMPTION_REVERSAL',
        })).filter((movement) => movement.refType === 'ORDER_LINE' && movement.refId === orderItem.id);
        expect(
          ingredient.reversalMovements,
          `Cancelling should create exactly one CONSUMPTION_REVERSAL for ${ingredient.item.name}.`,
        ).toHaveLength(1);
        expect(
          ingredient.reversalMovements[0].baseQty,
          `CONSUMPTION_REVERSAL movement should restore ${ingredient.item.name} recipe quantity.`,
        ).toBe(ingredient.expectedQty);
      }

      const tableAfterCancel = await getTable(request, auth, table.id);
      expect(tableAfterCancel.status, `Inventory test table ${table.id} should be released after cancellation.`).toBe(
        'AVAILABLE',
      );

      console.log(
        `inventory-consumption summary: ${JSON.stringify({
          menuItemId: dish.dishId,
          menuItemName: fixture.dish?.name ?? dish.dishId,
          orderItemId: orderItem.id,
          lifecycleStep: 'send-to-kitchen',
          ingredients: ingredients.map((ingredient) => ({
            itemId: ingredient.item.id,
            sku: ingredient.item.sku,
            name: ingredient.item.name,
            locationId: ingredient.locationId,
            locationName: ingredient.locationName,
            baseUnit: ingredient.item.baseUnit,
            initialQty: ingredient.initialQty,
            finalQty: ingredient.afterCancelQty,
            expectedDelta: ingredient.expectedQty,
            actualDeltaAfterSend: ingredient.initialQty - ingredient.afterSendQty,
          })),
        })}`,
      );
    } finally {
      if (orderId && !orderWasCancelled) {
        const order = await getOrder(request, auth, orderId).catch(() => null);
        if (order?.status && !['CLOSED', 'CANCELLED'].includes(order.status)) {
          await cancelOrder(request, auth, order.id, 'E2E inventory consumption cleanup').catch(
            () => undefined,
          );
        }
      }
      await resetOrderTable(request, auth, table).catch(() => undefined);
    }
  });
});
