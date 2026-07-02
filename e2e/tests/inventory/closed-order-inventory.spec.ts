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
  getReceipt,
  getTable,
  listActiveOrdersForTable,
  listFloors,
  listTables,
  markOrderServed,
  parseJsonBody,
  requireCustomerOrderRequestFixture,
  responseBodyText,
  sendOrderToKitchen,
  type CustomerOrderRequestFixture,
  type OrderResponse,
  type PaymentResponse,
  type PosAuthHeaders,
  type TableResponse,
} from '../../helpers/order-requests';
import { readFixtures } from '../../helpers/session';

const CLOSED_ORDER_TABLE_NAME = 'E2E Closed Order Inventory';
const CLOSED_ORDER_TABLE_QR = 'e2e-closed-order-inventory';

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

interface LoginResponse {
  accessToken: string;
  user: { id: string; email: string; fullName: string };
}

interface MyBranchAccessResponse {
  branchId: string;
  permissions: string[];
}

interface RecordPaymentResponse {
  payment: PaymentResponse;
  changeAmount: number;
  order: OrderResponse;
}

interface CountAdjustmentResponse {
  itemId: string;
  locationId: string;
  beforeBaseQty: number;
  afterBaseQty: number;
  deltaBaseQty: number;
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
  afterPaymentQty: number;
  afterCloseQty: number;
  afterRestoreQty: number;
  consumptionMovementIdsAfterSend: string[];
}

function authHeaders(accessToken: string, branchId: string): PosAuthHeaders {
  return {
    authorization: `Bearer ${accessToken}`,
    'x-branch-id': branchId,
    'content-type': 'application/json',
  };
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
      password: 'ChangeMe123!',
    },
  });
  if (!response.ok) {
    throw new Error(`POST /auth/login owner failed: ${response.status} ${response.text}`);
  }
  return parseJsonBody<LoginResponse>(response.text, 'POST /auth/login owner');
}

async function getMyBranchAccess(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  branchId: string,
): Promise<MyBranchAccessResponse> {
  const response = await requestText(
    request,
    'get',
    `${ENV.apiBaseUrl}/branches/${encodeURIComponent(branchId)}/my-access`,
    { headers: auth },
  );
  if (!response.ok) {
    throw new Error(`GET /branches/${branchId}/my-access failed: ${response.status} ${response.text}`);
  }
  return parseJsonBody<MyBranchAccessResponse>(response.text, `GET /branches/${branchId}/my-access`);
}

async function ensureClosedOrderInventoryTable(
  request: APIRequestContext,
  auth: PosAuthHeaders,
): Promise<TableResponse> {
  const existing = (await listTables(request, auth)).find(
    (table) => table.qrIdentifier === CLOSED_ORDER_TABLE_QR || table.name === CLOSED_ORDER_TABLE_NAME,
  );
  if (existing) return existing;

  const floors = await listFloors(request, auth);
  const floor = floors.find((candidate) => candidate.status === 'ACTIVE') ?? floors[0];
  if (!floor) {
    throw new Error('Cannot create closed-order inventory table: GET /floors returned no floors.');
  }

  return createTable(request, auth, {
    floorId: floor.id,
    name: CLOSED_ORDER_TABLE_NAME,
    seatCapacity: 2,
    qrIdentifier: CLOSED_ORDER_TABLE_QR,
  });
}

async function resetOrderTable(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  table: TableResponse,
): Promise<TableResponse> {
  const activeOrders = await listActiveOrdersForTable(request, auth, table.id);
  for (const order of activeOrders) {
    await cancelOrder(request, auth, order.id, 'E2E closed-order inventory setup cleanup');
  }

  const remaining = await listActiveOrdersForTable(request, auth, table.id);
  expect(
    remaining,
    `Closed-order inventory setup could not clear active orders for table ${table.id}.`,
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

async function setCountedOnHand(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  input: { itemId: string; locationId: string; unit: string; countedQty: number; reason: string },
): Promise<CountAdjustmentResponse> {
  const response = await requestText(request, 'post', `${ENV.apiBaseUrl}/inventory/adjustments/count`, {
    headers: auth,
    data: input,
  });
  if (!response.ok) {
    throw new Error(`POST /inventory/adjustments/count failed: ${response.status} ${response.text}`);
  }
  return parseJsonBody<CountAdjustmentResponse>(response.text, 'POST /inventory/adjustments/count');
}

async function recordCashPayment(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  orderId: string,
  totalAmount: number,
): Promise<RecordPaymentResponse> {
  const response = await requestText(
    request,
    'post',
    `${ENV.apiBaseUrl}/orders/${encodeURIComponent(orderId)}/payments`,
    {
      headers: auth,
      data: { method: 'CASH', amount: totalAmount, tenderedAmount: totalAmount },
    },
  );
  if (!response.ok) {
    throw new Error(`POST /orders/${orderId}/payments failed: ${response.status} ${response.text}`);
  }
  return parseJsonBody<RecordPaymentResponse>(response.text, `POST /orders/${orderId}/payments`);
}

async function closeOrder(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  orderId: string,
): Promise<OrderResponse> {
  const response = await requestText(
    request,
    'post',
    `${ENV.apiBaseUrl}/orders/${encodeURIComponent(orderId)}/close`,
    { headers: auth },
  );
  if (!response.ok) {
    throw new Error(`POST /orders/${orderId}/close failed: ${response.status} ${response.text}`);
  }
  return parseJsonBody<OrderResponse>(response.text, `POST /orders/${orderId}/close`);
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

function activePayments(order: OrderResponse): PaymentResponse[] {
  return (order.payments ?? []).filter((payment) => payment.state === 'ACTIVE');
}

async function consumptionMovementsForOrderLine(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  input: { branchId: string; itemId: string; orderItemId: string },
): Promise<StockMovementResponse[]> {
  return (await getItemMovements(request, auth, {
    branchId: input.branchId,
    itemId: input.itemId,
    type: 'CONSUMPTION_OUT',
  })).filter((movement) => movement.refType === 'ORDER_LINE' && movement.refId === input.orderItemId);
}

async function reversalMovementsForOrderLine(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  input: { branchId: string; itemId: string; orderItemId: string },
): Promise<StockMovementResponse[]> {
  return (await getItemMovements(request, auth, {
    branchId: input.branchId,
    itemId: input.itemId,
    type: 'CONSUMPTION_REVERSAL',
  })).filter((movement) => movement.refType === 'ORDER_LINE' && movement.refId === input.orderItemId);
}

test.describe('closed-order inventory behavior', () => {
  test('keeps completed sale stock consumed and does not duplicate ledger movements', async ({
    request,
  }) => {
    const fixture = readFixtures() as CustomerOrderRequestFixture;
    const branchId = fixture.branch?.id;
    if (!branchId) {
      throw new Error('Invalid E2E fixture: missing branch.id.');
    }
    const dish = requireCustomerOrderRequestFixture(fixture);

    await expectApiHealth(request, { label: 'primary API for closed-order inventory' });

    const owner = await loginOwner(request);
    const auth = authHeaders(owner.accessToken, branchId);
    const access = await getMyBranchAccess(request, auth, branchId);
    expect(access.permissions, 'The payment session must have PAYMENT_PROCESS.').toContain('PAYMENT_PROCESS');

    const table = await resetOrderTable(
      request,
      auth,
      await ensureClosedOrderInventoryTable(request, auth),
    );

    let orderId: string | undefined;
    let orderWasClosed = false;
    const ingredientsToRestore: IngredientExpectation[] = [];

    try {
      const recipe = await getRecipeForMenuItem(request, auth, dish.dishId);
      const expectedByItem = expectedConsumptionByItem(recipe, dish.modifierOptionIds);
      expect(expectedByItem.size, `Recipe ${recipe.id} should consume at least one ingredient.`).toBeGreaterThan(0);

      for (const [itemId, expectedQty] of expectedByItem) {
        const item = await getInventoryItem(request, auth, itemId);
        const initial = await getOnHandAtConsumptionLocation(request, auth, { branchId, item });
        expect(
          initial.quantity,
          `Ingredient ${item.name} should have enough stock for this isolated paid-order test.`,
        ).toBeGreaterThanOrEqual(expectedQty);
        ingredientsToRestore.push({
          item,
          locationId: initial.locationId,
          locationName: initial.locationName,
          expectedQty,
          initialQty: initial.quantity,
          afterAddQty: NaN,
          afterSendQty: NaN,
          afterServeQty: NaN,
          afterPaymentQty: NaN,
          afterCloseQty: NaN,
          afterRestoreQty: NaN,
          consumptionMovementIdsAfterSend: [],
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

      for (const ingredient of ingredientsToRestore) {
        const row = await getOnHandAtConsumptionLocation(request, auth, { branchId, item: ingredient.item });
        ingredient.afterAddQty = row.quantity;
        expect(
          ingredient.afterAddQty,
          `Adding the order item must not deduct ${ingredient.item.name}.`,
        ).toBe(ingredient.initialQty);

        const prematureMovements = await consumptionMovementsForOrderLine(request, auth, {
          branchId,
          itemId: ingredient.item.id,
          orderItemId: orderItem.id,
        });
        expect(
          prematureMovements,
          `No CONSUMPTION_OUT movement should exist for ${ingredient.item.name} before send-to-kitchen.`,
        ).toHaveLength(0);
      }

      const sent = await sendOrderToKitchen(request, auth, created.id);
      const sentOrderItem = orderItemForMenuItem(sent, dish.dishId);
      expect(sentOrderItem.id, 'Send-to-kitchen should keep the same order item id.').toBe(orderItem.id);
      expect(sentOrderItem.status, `Order item ${orderItem.id} should be sent to kitchen.`).toBe('SENT');

      for (const ingredient of ingredientsToRestore) {
        const row = await getOnHandAtConsumptionLocation(request, auth, { branchId, item: ingredient.item });
        ingredient.afterSendQty = row.quantity;
        expect(
          ingredient.initialQty - ingredient.afterSendQty,
          `Send-to-kitchen should consume the exact recipe quantity for ${ingredient.item.name}.`,
        ).toBe(ingredient.expectedQty);

        const consumptionMovements = await consumptionMovementsForOrderLine(request, auth, {
          branchId,
          itemId: ingredient.item.id,
          orderItemId: orderItem.id,
        });
        expect(
          consumptionMovements,
          `Exactly one CONSUMPTION_OUT movement should be recorded for ${ingredient.item.name}.`,
        ).toHaveLength(1);
        expect(
          consumptionMovements[0].baseQty,
          `CONSUMPTION_OUT movement should match ${ingredient.item.name} recipe quantity with a negative sign.`,
        ).toBe(-ingredient.expectedQty);
        ingredient.consumptionMovementIdsAfterSend = consumptionMovements.map((movement) => movement.id);
      }

      const served = await markOrderServed(request, auth, created.id);
      expect(served.status, `Order ${created.id} should be SERVED.`).toBe('SERVED');
      expect(served.paymentStatus, `Order ${created.id} should still be unpaid after serving.`).toBe('UNPAID');

      for (const ingredient of ingredientsToRestore) {
        const row = await getOnHandAtConsumptionLocation(request, auth, { branchId, item: ingredient.item });
        ingredient.afterServeQty = row.quantity;
        expect(
          ingredient.afterServeQty,
          `Serving should not deduct ${ingredient.item.name} a second time.`,
        ).toBe(ingredient.afterSendQty);

        const movementsAfterServe = await consumptionMovementsForOrderLine(request, auth, {
          branchId,
          itemId: ingredient.item.id,
          orderItemId: orderItem.id,
        });
        expect(
          movementsAfterServe.map((movement) => movement.id),
          `Serving should not create duplicate CONSUMPTION_OUT movements for ${ingredient.item.name}.`,
        ).toEqual(ingredient.consumptionMovementIdsAfterSend);
      }

      if (!served.totals || served.totals.totalAmount <= 0) {
        throw new Error(`Served order ${served.id} should have a positive total.`);
      }
      const totalAmount = served.totals.totalAmount;

      const paymentBody = await recordCashPayment(request, auth, served.id, totalAmount);
      expect(paymentBody.payment.method, `Payment for order ${served.id} should be cash.`).toBe('CASH');
      expect(paymentBody.payment.amount, `Payment amount for order ${served.id} should equal total.`).toBe(totalAmount);
      expect(paymentBody.order.paymentStatus, `Full payment should mark order ${served.id} paid.`).toBe('PAID');

      for (const ingredient of ingredientsToRestore) {
        const row = await getOnHandAtConsumptionLocation(request, auth, { branchId, item: ingredient.item });
        ingredient.afterPaymentQty = row.quantity;
        expect(
          ingredient.afterPaymentQty,
          `Payment should not deduct or restore ${ingredient.item.name}.`,
        ).toBe(ingredient.afterSendQty);

        const movementsAfterPayment = await consumptionMovementsForOrderLine(request, auth, {
          branchId,
          itemId: ingredient.item.id,
          orderItemId: orderItem.id,
        });
        expect(
          movementsAfterPayment.map((movement) => movement.id),
          `Payment should not create duplicate CONSUMPTION_OUT movements for ${ingredient.item.name}.`,
        ).toEqual(ingredient.consumptionMovementIdsAfterSend);
      }

      const closed = await closeOrder(request, auth, served.id);
      orderWasClosed = true;
      expect(closed.status, `Order ${served.id} should be CLOSED.`).toBe('CLOSED');
      expect(closed.paymentStatus, `Order ${served.id} should be PAID.`).toBe('PAID');
      expect(closed.paidAmount, `Order ${served.id} paidAmount should equal total.`).toBe(totalAmount);
      expect(closed.totals?.totalAmount, `Order ${served.id} total should not change on close.`).toBe(totalAmount);

      const reloadedClosed = await getOrder(request, auth, served.id);
      expect(reloadedClosed.status, `Reloaded order ${served.id} should be CLOSED.`).toBe('CLOSED');
      expect(reloadedClosed.paymentStatus, `Reloaded order ${served.id} should be PAID.`).toBe('PAID');
      expect(activePayments(reloadedClosed), `Closed order ${served.id} should have one active payment.`).toHaveLength(1);

      const receipt = await getReceipt(request, auth, served.id);
      expect(receipt.paymentStatus, `Receipt for order ${served.id} should be PAID.`).toBe('PAID');
      expect(receipt.totalAmount, `Receipt total for order ${served.id} should match order total.`).toBe(totalAmount);
      expect(receipt.payments, `Receipt for order ${served.id} should include one payment.`).toHaveLength(1);
      expect(receipt.payments[0].amount, `Receipt payment for order ${served.id} should equal total.`).toBe(totalAmount);
      expect(receipt.closedAt, `Receipt for order ${served.id} should include closedAt.`).toBeTruthy();

      for (const ingredient of ingredientsToRestore) {
        const row = await getOnHandAtConsumptionLocation(request, auth, { branchId, item: ingredient.item });
        ingredient.afterCloseQty = row.quantity;
        expect(
          ingredient.afterCloseQty,
          `Closing a paid order should leave ${ingredient.item.name} consumed, not restored.`,
        ).toBe(ingredient.afterSendQty);
        expect(
          ingredient.initialQty - ingredient.afterCloseQty,
          `Final closed-order stock delta for ${ingredient.item.name} should equal the recipe quantity.`,
        ).toBe(ingredient.expectedQty);

        const movementsAfterClose = await consumptionMovementsForOrderLine(request, auth, {
          branchId,
          itemId: ingredient.item.id,
          orderItemId: orderItem.id,
        });
        expect(
          movementsAfterClose.map((movement) => movement.id),
          `Close should not create duplicate CONSUMPTION_OUT movements for ${ingredient.item.name}.`,
        ).toEqual(ingredient.consumptionMovementIdsAfterSend);

        const reversalsAfterClose = await reversalMovementsForOrderLine(request, auth, {
          branchId,
          itemId: ingredient.item.id,
          orderItemId: orderItem.id,
        });
        expect(
          reversalsAfterClose,
          `Closing a completed sale must not create CONSUMPTION_REVERSAL for ${ingredient.item.name}.`,
        ).toHaveLength(0);
      }

      const tableAfterClose = await getTable(request, auth, table.id);
      expect(tableAfterClose.status, `Closed-order inventory table ${table.id} should move to CLEANING after close.`).toBe(
        'CLEANING',
      );
      const activeAfterClose = await listActiveOrdersForTable(request, auth, table.id);
      expect(activeAfterClose, `Table ${table.id} should have no active orders after close.`).toHaveLength(0);

      console.log(
        `closed-order-inventory summary before restore: ${JSON.stringify({
          menuItemId: dish.dishId,
          menuItemName: fixture.dish?.name ?? dish.dishId,
          orderId: served.id,
          orderItemId: orderItem.id,
          paymentProcessor: owner.user.email,
          ingredients: ingredientsToRestore.map((ingredient) => ({
            itemId: ingredient.item.id,
            sku: ingredient.item.sku,
            name: ingredient.item.name,
            locationId: ingredient.locationId,
            locationName: ingredient.locationName,
            baseUnit: ingredient.item.baseUnit,
            initialQty: ingredient.initialQty,
            afterSendQty: ingredient.afterSendQty,
            afterServeQty: ingredient.afterServeQty,
            afterPaymentQty: ingredient.afterPaymentQty,
            afterCloseQty: ingredient.afterCloseQty,
            expectedFinalDelta: ingredient.expectedQty,
            actualFinalDelta: ingredient.initialQty - ingredient.afterCloseQty,
            consumptionMovementIds: ingredient.consumptionMovementIdsAfterSend,
          })),
        })}`,
      );
    } finally {
      for (const ingredient of ingredientsToRestore) {
        const current = await getOnHandAtConsumptionLocation(request, auth, {
          branchId,
          item: ingredient.item,
        }).catch(() => null);
        if (!current || current.quantity === ingredient.initialQty) {
          ingredient.afterRestoreQty = current?.quantity ?? ingredient.afterRestoreQty;
          continue;
        }
        const restored = await setCountedOnHand(request, auth, {
          itemId: ingredient.item.id,
          locationId: ingredient.locationId,
          unit: ingredient.item.baseUnit,
          countedQty: ingredient.initialQty,
          reason: `E2E closed-order inventory restore for ${orderId ?? '<unknown order>'}`,
        }).catch((error) => {
          console.error(
            `closed-order-inventory restore failed for ${ingredient.item.name} (${ingredient.item.id}) at ${ingredient.locationId}: ${String(error)}`,
          );
          return null;
        });
        ingredient.afterRestoreQty = restored?.afterBaseQty ?? Number.NaN;
      }

      if (orderId && !orderWasClosed) {
        const order = await getOrder(request, auth, orderId).catch(() => null);
        if (order?.status && !['CLOSED', 'CANCELLED'].includes(order.status)) {
          await cancelOrder(request, auth, order.id, 'E2E closed-order inventory cleanup').catch(
            () => undefined,
          );
        }
      }
      await resetOrderTable(request, auth, table).catch(() => undefined);

      console.log(
        `closed-order-inventory restore summary: ${JSON.stringify({
          orderId,
          stockRestoredBy: 'POST /inventory/adjustments/count',
          ingredients: ingredientsToRestore.map((ingredient) => ({
            itemId: ingredient.item.id,
            name: ingredient.item.name,
            locationId: ingredient.locationId,
            initialQty: ingredient.initialQty,
            afterCloseQty: ingredient.afterCloseQty,
            afterRestoreQty: ingredient.afterRestoreQty,
          })),
        })}`,
      );
    }
  });
});
