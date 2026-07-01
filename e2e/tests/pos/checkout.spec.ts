import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import * as path from 'node:path';
import { ENV } from '../../config/env';
import { openActor, closeActor, type Actor } from '../../helpers/actors';
import { expectApiHealth, expectFrontendReachable } from '../../helpers/health';
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
  seededOwnerAuthHeaders,
  sendOrderToKitchen,
  type CustomerOrderRequestFixture,
  type OrderResponse,
  type PosAuthHeaders,
  type TableResponse,
} from '../../helpers/order-requests';
import { readFixtures } from '../../helpers/session';
import { posStorageState, seedPosDeviceSecret } from '../../helpers/storage';

const ARTIFACTS = path.resolve(__dirname, '../../artifacts/actors-pos-checkout');
const HANDOFF = 30_000;
const CHECKOUT_TABLE_NAME = 'E2E Checkout';
const CHECKOUT_TABLE_QR = 'e2e-tavern-ararat-checkout';

interface CheckoutFixture extends CustomerOrderRequestFixture {
  checkoutTable?: { id?: string; name?: string; qr?: string };
  pos?: { deviceSecret?: string };
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: Record<string, unknown>;
}

function requirePosDeviceSecret(fixture: CheckoutFixture): string {
  const secret = fixture.pos?.deviceSecret;
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new Error(
      `Invalid checkout E2E fixture: missing pos.deviceSecret.\nfixture path: ${ENV.fixturesPath}`,
    );
  }
  return secret;
}

async function visibleTexts(locator: Locator): Promise<string[]> {
  return locator.evaluateAll((elements) =>
    elements
      .map((element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      .filter((text) => text.length > 0),
  );
}

async function posDiagnostics(page: Page): Promise<string> {
  return [
    `current URL: ${page.url()}`,
    `visible buttons: ${(await visibleTexts(page.locator('button:visible'))).join(' | ') || '<none>'}`,
    `visible alerts: ${(await visibleTexts(page.locator('[role="alert"]:visible, .text-red-600:visible, .text-red-700:visible'))).join(' | ') || '<none>'}`,
  ].join('\n');
}

async function ownerPosSession(
  request: APIRequestContext,
  fixture: CheckoutFixture,
): Promise<ReturnType<typeof posStorageState>> {
  const branchId = fixture.branch?.id;
  if (typeof branchId !== 'string' || branchId.length === 0) {
    throw new Error(`Invalid checkout E2E fixture: missing branch.id.\nfixture path: ${ENV.fixturesPath}`);
  }

  const response = await request.post(`${ENV.apiBaseUrl}/auth/login`, {
    headers: { 'content-type': 'application/json' },
    data: {
      email: 'owner@tavern-ararat.am',
      password: 'ChangeMe123!',
    },
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  const text = await responseBodyText(response);
  if (!response.ok()) {
    throw new Error(`POST /auth/login for POS checkout session failed: ${response.status()} ${text}`);
  }

  const login = parseJsonBody<LoginResponse>(text, 'POST /auth/login for POS checkout session');
  return posStorageState(ENV.posOrigin, { ...login, branchId });
}

async function ensureCheckoutTable(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  fixture: CheckoutFixture,
): Promise<TableResponse> {
  const fixtureTableId = fixture.checkoutTable?.id;
  if (typeof fixtureTableId === 'string' && fixtureTableId.length > 0) {
    const table = await getTable(request, auth, fixtureTableId).catch(() => null);
    if (table) return table;
  }

  const qr = fixture.checkoutTable?.qr || CHECKOUT_TABLE_QR;
  const name = fixture.checkoutTable?.name || CHECKOUT_TABLE_NAME;
  const existing = (await listTables(request, auth)).find(
    (table) => table.qrIdentifier === qr || table.name === name,
  );
  if (existing) return existing;

  const floors = await listFloors(request, auth);
  const floor = floors.find((candidate) => candidate.status === 'ACTIVE') ?? floors[0];
  if (!floor) {
    throw new Error('Cannot create checkout E2E table: GET /floors returned no floors.');
  }

  return createTable(request, auth, {
    floorId: floor.id,
    name,
    seatCapacity: 2,
    qrIdentifier: qr,
  });
}

async function resetTableForCheckout(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  table: TableResponse,
): Promise<TableResponse> {
  const activeOrders = await listActiveOrdersForTable(request, auth, table.id);
  for (const order of activeOrders) {
    await cancelOrder(request, auth, order.id, 'E2E checkout setup cleanup');
  }

  const afterCancel = await listActiveOrdersForTable(request, auth, table.id);
  expect(
    afterCancel,
    [
      'Checkout setup could not clear active orders for the checkout table.',
      `table id/name: ${table.id} / ${table.name}`,
      `remaining order ids/statuses: ${afterCancel.map((order) => `${order.id}:${order.status}`).join(', ') || '<none>'}`,
    ].join('\n'),
  ).toHaveLength(0);

  const current = await getTable(request, auth, table.id);
  if (current.status === 'CLEANING' || current.status === 'DISABLED') {
    return changeTableStatus(request, auth, table.id, 'AVAILABLE');
  }
  return current;
}

async function prepareServedCheckoutOrder(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  table: TableResponse,
  fixture: CheckoutFixture,
): Promise<OrderResponse> {
  const dish = requireCustomerOrderRequestFixture(fixture);

  const created = await createDineInOrder(request, auth, table.id);
  await addOrderItem(request, auth, created.id, {
    menuItemId: dish.dishId,
    quantity: 1,
    selectedOptionIds: dish.modifierOptionIds,
  });
  await sendOrderToKitchen(request, auth, created.id);
  const served = await markOrderServed(request, auth, created.id);

  expect(served.status, `Prepared checkout order ${created.id} should be SERVED.`).toBe('SERVED');
  expect(served.tableId, `Prepared checkout order ${created.id} should stay on checkout table.`).toBe(table.id);
  expect(served.paymentStatus, `Prepared checkout order ${created.id} should start unpaid.`).toBe('UNPAID');
  expect(served.totals?.totalAmount, `Prepared checkout order ${created.id} total should be positive.`).toBeGreaterThan(0);

  return served;
}

function activePayments(order: OrderResponse) {
  return (order.payments ?? []).filter((payment) => payment.state === 'ACTIVE');
}

test.describe('POS checkout', () => {
  let pos: Actor | undefined;

  test.afterEach(async () => {
    if (pos) {
      await closeActor(pos, ARTIFACTS);
      pos = undefined;
    }
  });

  test('records cash payment, closes a dine-in order, and releases the table from active service', async ({
    browser,
    request,
  }) => {
    const fixture = readFixtures() as CheckoutFixture;
    const posDeviceSecret = requirePosDeviceSecret(fixture);

    await expectFrontendReachable(request, 'POS on admin PC', ENV.posBaseUrl);
    await expectApiHealth(request, { label: 'primary API for POS checkout' });

    const auth = await seededOwnerAuthHeaders(request, fixture);
    const checkoutTable = await resetTableForCheckout(
      request,
      auth,
      await ensureCheckoutTable(request, auth, fixture),
    );
    const servedOrder = await prepareServedCheckoutOrder(request, auth, checkoutTable, fixture);
    const totalAmount = servedOrder.totals?.totalAmount;
    expect(totalAmount, `Prepared checkout order ${servedOrder.id} has no totalAmount.`).toBeGreaterThan(0);

    const storageState = await ownerPosSession(request, fixture);
    pos = await openActor(browser, 'pos', {
      artifactsDir: ARTIFACTS,
      baseURL: ENV.posBaseUrl,
      storageState,
    });

    await pos.page.goto(ENV.posBaseUrl, { waitUntil: 'domcontentloaded' });
    await seedPosDeviceSecret(pos.page, posDeviceSecret);
    await pos.page.reload({ waitUntil: 'domcontentloaded' });

    const tableTile = pos.page.locator(`[data-testid="table-tile"][data-table-id="${checkoutTable.id}"]`);
    await expect(
      tableTile,
      [
        `POS did not show checkout table ${checkoutTable.id}.`,
        `table name: ${checkoutTable.name}`,
        await posDiagnostics(pos.page),
      ].join('\n'),
    ).toBeVisible({ timeout: HANDOFF });
    await expect(tableTile, `Checkout table ${checkoutTable.id} did not render as occupied.`).toHaveAttribute(
      'data-table-status',
      'OCCUPIED',
      { timeout: HANDOFF },
    );

    await tableTile.click();
    await expect(pos.page.getByTestId('go-to-checkout'), 'POS did not open the prepared order from the table tile.').toBeVisible({
      timeout: HANDOFF,
    });
    await pos.page.getByTestId('go-to-checkout').click();
    await expect(pos.page.getByTestId('pay-submit'), 'POS checkout payment form did not render.').toBeVisible({
      timeout: HANDOFF,
    });

    await pos.page.locator('#pay-tendered').fill(String(totalAmount));

    const paymentResponsePromise = pos.page.waitForResponse((response) => {
      const req = response.request();
      return (
        req.method() === 'POST' &&
        response.url().includes(`/orders/${encodeURIComponent(servedOrder.id)}/payments`)
      );
    });
    await expect(pos.page.getByTestId('pay-submit'), 'Cash payment submit stayed disabled.').toBeEnabled();
    await pos.page.getByTestId('pay-submit').click();

    const paymentResponse = await paymentResponsePromise;
    const paymentText = await responseBodyText(paymentResponse);
    expect(paymentResponse.ok(), `POST /orders/${servedOrder.id}/payments failed: ${paymentResponse.status()} ${paymentText}`).toBeTruthy();

    const closeButton = pos.page.getByTestId('close-order');
    await expect(closeButton, 'Close order button did not become enabled after full cash payment.').toBeEnabled({
      timeout: HANDOFF,
    });

    const closeResponsePromise = pos.page.waitForResponse((response) => {
      const req = response.request();
      return (
        req.method() === 'POST' &&
        response.url().includes(`/orders/${encodeURIComponent(servedOrder.id)}/close`)
      );
    });
    await closeButton.click();

    const closeResponse = await closeResponsePromise;
    const closeText = await responseBodyText(closeResponse);
    expect(closeResponse.ok(), `POST /orders/${servedOrder.id}/close failed: ${closeResponse.status()} ${closeText}`).toBeTruthy();

    await expect(pos.page.getByTestId('order-closed'), 'POS did not render the closed-order state.').toBeVisible({
      timeout: HANDOFF,
    });

    const closedOrder = await getOrder(request, auth, servedOrder.id);
    expect(closedOrder.status, `Order ${servedOrder.id} should be CLOSED.`).toBe('CLOSED');
    expect(closedOrder.paymentStatus, `Order ${servedOrder.id} should be PAID.`).toBe('PAID');
    expect(closedOrder.paidAmount, `Order ${servedOrder.id} paidAmount should equal total.`).toBe(totalAmount);
    expect(closedOrder.totals?.totalAmount, `Order ${servedOrder.id} total changed unexpectedly.`).toBe(totalAmount);

    const payments = activePayments(closedOrder);
    expect(payments, `Order ${servedOrder.id} should have exactly one active payment.`).toHaveLength(1);
    expect(payments[0].method, `Order ${servedOrder.id} payment should be cash.`).toBe('CASH');
    expect(payments[0].amount, `Order ${servedOrder.id} payment amount should equal total.`).toBe(totalAmount);
    expect(payments[0].tenderedAmount, `Order ${servedOrder.id} tendered amount should equal total.`).toBe(totalAmount);

    const receipt = await getReceipt(request, auth, servedOrder.id);
    expect(receipt.paymentStatus, `Receipt for order ${servedOrder.id} should be PAID.`).toBe('PAID');
    expect(receipt.totalAmount, `Receipt total for order ${servedOrder.id} should match order total.`).toBe(totalAmount);
    expect(receipt.payments, `Receipt for order ${servedOrder.id} should include one payment.`).toHaveLength(1);
    expect(receipt.payments[0].method, `Receipt payment for order ${servedOrder.id} should be cash.`).toBe('CASH');
    expect(receipt.payments[0].amount, `Receipt payment for order ${servedOrder.id} should equal total.`).toBe(totalAmount);
    expect(receipt.closedAt, `Receipt for order ${servedOrder.id} should include closedAt.`).toBeTruthy();

    const tableAfterClose = await getTable(request, auth, checkoutTable.id);
    expect(tableAfterClose.status, `Checkout table ${checkoutTable.id} should move to CLEANING after close.`).toBe('CLEANING');

    const activeAfterClose = await listActiveOrdersForTable(request, auth, checkoutTable.id);
    expect(
      activeAfterClose,
      `Checkout table ${checkoutTable.id} should have no active orders after close.`,
    ).toHaveLength(0);
  });
});
