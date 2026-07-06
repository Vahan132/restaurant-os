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
  type PaymentResponse,
  type PosAuthHeaders,
  type TableResponse,
} from '../../helpers/order-requests';
import { readFixtures } from '../../helpers/session';
import { posStorageState, seedPosDeviceSecret } from '../../helpers/storage';

const ARTIFACTS = path.resolve(__dirname, '../../artifacts/actors-pos-discount-step-up-ui');
const HANDOFF = 30_000;
const STAFF_PASSWORD = 'ChangeMe123!';
const DISCOUNT_TABLE_NAME = 'E2E Discount Step Up UI';
const DISCOUNT_TABLE_QR = 'e2e-discount-step-up-ui';
const DISCOUNT_TYPE = 'PERCENT';
const DISCOUNT_VALUE_BPS = 1000;

interface DiscountStepUpFixture extends CustomerOrderRequestFixture {
  pos?: { deviceSecret?: string; userId?: string; pin?: string; fullName?: string };
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; fullName: string };
}

interface PinLoginResponse {
  accessToken: string;
  refreshToken: string;
  branchId: string;
  mustRotate?: boolean;
  user: { id: string; email: string; fullName: string };
}

interface StaffPickerEntry {
  id: string;
  fullName: string;
  roleCode: string | null;
  roleName: string | null;
}

interface PinIssuedResponse {
  pin: string;
  mustRotate: boolean;
}

interface MyBranchAccessResponse {
  branchId: string;
  permissions: string[];
}

interface RestaurantSettingsResponse {
  serviceFeeRateBps: number;
  allowDiscounts: boolean;
  requireApprovalForDiscount: boolean;
}

function requireFixtureString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid discount-step-up UI E2E fixture: missing ${field}.\nfixture path: ${ENV.fixturesPath}`);
  }
  return value;
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

function applyBpsHalfUp(amount: number, bps: number): number {
  return Math.floor((amount * bps + 5000) / 10000);
}

function pickInvalidPin(validPin: string): string {
  const length = Math.max(validPin.length, 6);
  const allZeroes = '0'.repeat(length);
  if (allZeroes !== validPin) return allZeroes;
  return '1'.repeat(length);
}

function activePayments(order: OrderResponse): PaymentResponse[] {
  return (order.payments ?? []).filter((payment) => payment.state === 'ACTIVE');
}

function formatMoney(minor: number, currency = 'AMD', locale = 'en'): string {
  const zeroDecimal = new Set(['AMD', 'JPY', 'KRW', 'VND', 'CLP', 'ISK', 'UGX', 'XAF', 'XOF', 'PYG', 'RWF']);
  const threeDecimal = new Set(['BHD', 'KWD', 'OMR', 'TND', 'JOD']);
  const code = currency.toUpperCase();
  const decimals = zeroDecimal.has(code) ? 0 : threeDecimal.has(code) ? 3 : 2;
  const factor = 10 ** decimals;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(minor / factor);
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

async function requestText(
  request: APIRequestContext,
  method: 'get' | 'post',
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

async function pinLogin(
  request: APIRequestContext,
  input: { deviceSecret: string; userId: string; pin: string },
  label: string,
): Promise<PinLoginResponse> {
  const response = await requestText(request, 'post', `${ENV.apiBaseUrl}/auth/pin-login`, {
    headers: { 'content-type': 'application/json' },
    data: input,
  });
  if (!response.ok) {
    throw new Error(`POST /auth/pin-login as ${label} failed: ${response.status} ${response.text}`);
  }
  return parseJsonBody<PinLoginResponse>(response.text, `POST /auth/pin-login as ${label}`);
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

async function getRestaurantSettings(
  request: APIRequestContext,
  auth: PosAuthHeaders,
): Promise<RestaurantSettingsResponse> {
  const response = await requestText(request, 'get', `${ENV.apiBaseUrl}/restaurant/settings`, {
    headers: auth,
  });
  if (!response.ok) {
    throw new Error(`GET /restaurant/settings failed: ${response.status} ${response.text}`);
  }
  return parseJsonBody<RestaurantSettingsResponse>(response.text, 'GET /restaurant/settings');
}

async function listStaffForDevice(
  request: APIRequestContext,
  deviceSecret: string,
): Promise<StaffPickerEntry[]> {
  const response = await requestText(request, 'get', `${ENV.apiBaseUrl}/auth/staff-picker`, {
    headers: { 'x-device-secret': deviceSecret },
  });
  if (!response.ok) {
    throw new Error(`GET /auth/staff-picker failed: ${response.status} ${response.text}`);
  }
  return parseListResponse<StaffPickerEntry>(response.text, 'GET /auth/staff-picker');
}

async function resetStaffPin(
  request: APIRequestContext,
  ownerAccessToken: string,
  userId: string,
): Promise<PinIssuedResponse> {
  const response = await requestText(
    request,
    'post',
    `${ENV.apiBaseUrl}/staff-pins/${encodeURIComponent(userId)}/reset`,
    { headers: { authorization: `Bearer ${ownerAccessToken}` } },
  );
  if (!response.ok) {
    throw new Error(`POST /staff-pins/${userId}/reset failed: ${response.status} ${response.text}`);
  }
  return parseJsonBody<PinIssuedResponse>(response.text, `POST /staff-pins/${userId}/reset`);
}

async function ensureTable(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  input: { name: string; qr: string },
): Promise<TableResponse> {
  const existing = (await listTables(request, auth)).find(
    (table) => table.qrIdentifier === input.qr || table.name === input.name,
  );
  if (existing) return existing;

  const floors = await listFloors(request, auth);
  const floor = floors.find((candidate) => candidate.status === 'ACTIVE') ?? floors[0];
  if (!floor) {
    throw new Error(`Cannot create discount step-up UI table ${input.name}: GET /floors returned no floors.`);
  }

  return createTable(request, auth, {
    floorId: floor.id,
    name: input.name,
    seatCapacity: 2,
    qrIdentifier: input.qr,
  });
}

async function resetOrderTable(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  table: TableResponse,
): Promise<TableResponse> {
  const activeOrders = await listActiveOrdersForTable(request, auth, table.id);
  for (const order of activeOrders) {
    await cancelOrder(request, auth, order.id, 'E2E discount step-up UI setup cleanup');
  }

  const remaining = await listActiveOrdersForTable(request, auth, table.id);
  expect(
    remaining,
    `Discount step-up UI setup could not clear active orders for table ${table.id}.`,
  ).toHaveLength(0);

  const current = await getTable(request, auth, table.id);
  if (current.status === 'CLEANING' || current.status === 'DISABLED') {
    return changeTableStatus(request, auth, table.id, 'AVAILABLE');
  }
  return current;
}

async function prepareServedOrder(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  table: TableResponse,
  fixture: DiscountStepUpFixture,
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

  expect(served.status, `Prepared discount step-up UI order ${created.id} should be SERVED.`).toBe('SERVED');
  expect(served.tableId, `Prepared order ${created.id} should stay on the discount step-up UI table.`).toBe(table.id);
  expect(served.paymentStatus, `Prepared order ${created.id} should start unpaid.`).toBe('UNPAID');
  expect(served.discountType, `Prepared order ${created.id} should start with no discount type.`).toBeNull();
  expect(served.discountValue, `Prepared order ${created.id} should start with no discount value.`).toBeNull();
  expect(served.totals?.discountAmount, `Prepared order ${created.id} should start undiscounted.`).toBe(0);
  expect(served.totals?.subtotalAmount, `Prepared order ${created.id} subtotal should be positive.`).toBeGreaterThan(0);
  expect(served.totals?.totalAmount, `Prepared order ${created.id} total should be positive.`).toBeGreaterThan(0);
  return served;
}

async function pressPin(page: Page, pin: string): Promise<void> {
  for (const digit of pin) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
}

test.describe('POS discount step-up UI', () => {
  let pos: Actor | undefined;

  test.afterEach(async () => {
    if (pos) {
      await closeActor(pos, ARTIFACTS);
      pos = undefined;
    }
  });

  test('rejects wrong manager PIN, then applies approved discount without creating a payment', async ({
    browser,
    request,
  }) => {
    const fixture = readFixtures() as DiscountStepUpFixture;
    const branchId = requireFixtureString(fixture.branch?.id, 'branch.id');
    const deviceSecret = requireFixtureString(fixture.pos?.deviceSecret, 'pos.deviceSecret');
    const waiterUserId = requireFixtureString(fixture.pos?.userId, 'pos.userId');
    const waiterPin = requireFixtureString(fixture.pos?.pin, 'pos.pin');

    await expectFrontendReachable(request, 'POS on admin PC', ENV.posBaseUrl);
    await expectApiHealth(request, { label: 'primary API for POS discount step-up UI' });

    const ownerLogin = await loginOwner(request);
    const ownerHeaders = authHeaders(ownerLogin.accessToken, branchId);

    let discountTable: TableResponse | undefined;
    let orderId: string | undefined;

    try {
      const settings = await getRestaurantSettings(request, ownerHeaders);
      expect(settings.allowDiscounts, 'Restaurant settings must allow discounts for this E2E.').toBe(true);

      discountTable = await resetOrderTable(
        request,
        ownerHeaders,
        await ensureTable(request, ownerHeaders, {
          name: DISCOUNT_TABLE_NAME,
          qr: DISCOUNT_TABLE_QR,
        }),
      );

      const servedOrder = await prepareServedOrder(request, ownerHeaders, discountTable, fixture);
      orderId = servedOrder.id;
      const originalTotals = servedOrder.totals;
      expect(originalTotals, `Prepared order ${servedOrder.id} should include totals.`).toBeTruthy();
      if (!originalTotals) {
        throw new Error(`Prepared order ${servedOrder.id} did not include totals.`);
      }

      const waiterLogin = await pinLogin(
        request,
        { deviceSecret, userId: waiterUserId, pin: waiterPin },
        'WAITER',
      );
      expect(waiterLogin.branchId, 'Waiter PIN login should bind to the fixture branch.').toBe(branchId);
      const waiterHeaders = authHeaders(waiterLogin.accessToken, branchId);
      const waiterAccess = await getMyBranchAccess(request, waiterHeaders, branchId);
      expect(waiterAccess.permissions, 'Seeded WAITER should have ORDER_EDIT.').toContain('ORDER_EDIT');
      expect(waiterAccess.permissions, 'Seeded WAITER should not have DISCOUNT_APPLY.').not.toContain(
        'DISCOUNT_APPLY',
      );

      const staff = await listStaffForDevice(request, deviceSecret);
      const manager = staff.find((entry) => entry.roleCode === 'MANAGER');
      if (!manager) {
        throw new Error(`Could not find a MANAGER in staff picker. Entries: ${JSON.stringify(staff)}`);
      }
      const managerPin = await resetStaffPin(request, ownerLogin.accessToken, manager.id);

      const managerLogin = await pinLogin(
        request,
        { deviceSecret, userId: manager.id, pin: managerPin.pin },
        'MANAGER',
      );
      expect(managerLogin.branchId, 'Manager PIN login should bind to the fixture branch.').toBe(branchId);
      const managerHeaders = authHeaders(managerLogin.accessToken, branchId);
      const managerAccess = await getMyBranchAccess(request, managerHeaders, branchId);
      expect(managerAccess.permissions, 'Seeded MANAGER should have DISCOUNT_APPLY.').toContain(
        'DISCOUNT_APPLY',
      );

      const invalidManagerPin = pickInvalidPin(managerPin.pin);
      expect(invalidManagerPin, 'Invalid PIN fixture should differ from the real manager PIN.').not.toBe(
        managerPin.pin,
      );

      const expectedDiscountAmount = applyBpsHalfUp(originalTotals.subtotalAmount, DISCOUNT_VALUE_BPS);
      const expectedDiscountedSubtotal = originalTotals.subtotalAmount - expectedDiscountAmount;
      const expectedServiceFee = applyBpsHalfUp(expectedDiscountedSubtotal, settings.serviceFeeRateBps);
      const expectedTotal = expectedDiscountedSubtotal + expectedServiceFee;
      const currency = originalTotals.currency;
      const originalTotalText = formatMoney(originalTotals.totalAmount, currency);
      const expectedDiscountText = formatMoney(expectedDiscountAmount, currency);
      const expectedTotalText = formatMoney(expectedTotal, currency);

      pos = await openActor(browser, 'pos', {
        artifactsDir: ARTIFACTS,
        baseURL: ENV.posBaseUrl,
        storageState: posStorageState(ENV.posOrigin, waiterLogin),
      });

      await pos.page.goto(ENV.posBaseUrl, { waitUntil: 'domcontentloaded' });
      await seedPosDeviceSecret(pos.page, deviceSecret);
      await pos.page.reload({ waitUntil: 'domcontentloaded' });

      const tableTile = pos.page.locator(`[data-testid="table-tile"][data-table-id="${discountTable.id}"]`);
      await expect(
        tableTile,
        [
          `POS did not show discount step-up UI table ${discountTable.id}.`,
          `table name: ${discountTable.name}`,
          await posDiagnostics(pos.page),
        ].join('\n'),
      ).toBeVisible({ timeout: HANDOFF });
      await expect(tableTile, `Discount step-up UI table ${discountTable.id} did not render as occupied.`).toHaveAttribute(
        'data-table-status',
        'OCCUPIED',
        { timeout: HANDOFF },
      );

      await tableTile.click();
      await expect(pos.page.getByTestId('go-to-checkout'), 'POS did not open the prepared order from the table tile.').toBeVisible({
        timeout: HANDOFF,
      });
      await expect(pos.page.locator('body'), 'Order UI should show the original total before discount.').toContainText(
        originalTotalText,
      );

      await pos.page.getByRole('button', { name: 'Discount', exact: true }).click();
      await expect(pos.page.getByRole('heading', { name: 'Discount', exact: true }), 'Discount sheet did not open.').toBeVisible({
        timeout: HANDOFF,
      });
      await pos.page.getByLabel('Percentage (%)').fill('10');
      await expect(pos.page.getByRole('button', { name: 'Apply discount', exact: true })).toBeEnabled();
      await pos.page.getByRole('button', { name: 'Apply discount', exact: true }).click();

      await expect(
        pos.page.getByRole('heading', { name: 'Manager authorization', exact: true }),
        'Manager PIN authorization modal did not open for waiter discount.',
      ).toBeVisible({ timeout: HANDOFF });

      const failedDiscountResponsePromise = pos.page.waitForResponse((response) => {
        const req = response.request();
        return (
          req.method() === 'POST' &&
          response.url().includes(`/orders/${encodeURIComponent(servedOrder.id)}/discount`)
        );
      });
      await pressPin(pos.page, invalidManagerPin);
      const failedDiscountResponse = await failedDiscountResponsePromise;
      const failedDiscountText = await responseBodyText(failedDiscountResponse);
      expect(
        failedDiscountResponse.ok(),
        `Wrong manager PIN must be rejected by POS UI discount request: ${failedDiscountResponse.status()} ${failedDiscountText}`,
      ).toBeFalsy();
      await expect(
        pos.page.getByText('Authorization failed. Try again.', { exact: true }),
        'Wrong manager PIN rejection did not stay visible in the modal.',
      ).toBeVisible({ timeout: HANDOFF });

      const afterWrongPin = await getOrder(request, ownerHeaders, servedOrder.id);
      expect(afterWrongPin.discountType, 'Wrong manager PIN must not set discount type.').toBeNull();
      expect(afterWrongPin.discountValue, 'Wrong manager PIN must not set discount value.').toBeNull();
      expect(afterWrongPin.totals?.discountAmount, 'Wrong manager PIN must not apply discount.').toBe(0);
      expect(afterWrongPin.totals?.totalAmount, 'Wrong manager PIN must not change total.').toBe(
        originalTotals.totalAmount,
      );
      await expect(pos.page.locator('body'), 'Order UI should keep the original total after wrong PIN.').toContainText(
        originalTotalText,
      );

      const approvedDiscountResponsePromise = pos.page.waitForResponse((response) => {
        const req = response.request();
        return (
          req.method() === 'POST' &&
          response.url().includes(`/orders/${encodeURIComponent(servedOrder.id)}/discount`)
        );
      });
      await pressPin(pos.page, managerPin.pin);
      const approvedDiscountResponse = await approvedDiscountResponsePromise;
      const approvedDiscountText = await responseBodyText(approvedDiscountResponse);
      expect(
        approvedDiscountResponse.ok(),
        `Valid manager PIN discount request failed: ${approvedDiscountResponse.status()} ${approvedDiscountText}`,
      ).toBeTruthy();

      await expect(
        pos.page.getByRole('heading', { name: 'Manager authorization', exact: true }),
        'Manager authorization modal should close after valid approval.',
      ).toBeHidden({ timeout: HANDOFF });

      await expect(pos.page.locator('body'), 'Order UI should show the approved discount amount.').toContainText(
        expectedDiscountText,
      );
      await expect(pos.page.locator('body'), 'Order UI should show the discounted total.').toContainText(
        expectedTotalText,
      );

      const approvedOrder = await getOrder(request, ownerHeaders, servedOrder.id);
      expect(approvedOrder.discountType, 'Approved discount type should be saved.').toBe(DISCOUNT_TYPE);
      expect(approvedOrder.discountValue, 'Approved discount value should be saved.').toBe(DISCOUNT_VALUE_BPS);
      expect(approvedOrder.totals?.subtotalAmount, 'Approved discount must not change subtotal.').toBe(
        originalTotals.subtotalAmount,
      );
      expect(approvedOrder.totals?.discountAmount, 'Approved discount amount should be 10% of subtotal.').toBe(
        expectedDiscountAmount,
      );
      expect(approvedOrder.totals?.serviceFeeAmount, 'Approved discount should recompute service fee.').toBe(
        expectedServiceFee,
      );
      expect(approvedOrder.totals?.totalAmount, 'Approved discount should reduce final total correctly.').toBe(
        expectedTotal,
      );
      expect(approvedOrder.paymentStatus, 'Discount flow should leave the unpaid order unpaid.').toBe('UNPAID');
      expect(approvedOrder.paidAmount, 'Discount flow should not create paid amount.').toBe(0);
      expect(activePayments(approvedOrder), 'Discount flow should not create an active payment.').toHaveLength(0);

      await pos.page.getByTestId('go-to-checkout').click();
      await expect(
        pos.page.getByRole('heading', { name: /Checkout/, exact: false }),
        'POS checkout screen did not render.',
      ).toBeVisible({ timeout: HANDOFF });
      await expect(pos.page.locator('body'), 'Checkout UI should show the approved discount amount.').toContainText(
        expectedDiscountText,
      );
      await expect(pos.page.locator('body'), 'Checkout UI should show the discounted total.').toContainText(
        expectedTotalText,
      );

      const receipt = await getReceipt(request, ownerHeaders, servedOrder.id);
      expect(receipt.subtotalAmount, `Receipt subtotal for order ${servedOrder.id} should match order.`).toBe(
        originalTotals.subtotalAmount,
      );
      expect(receipt.discountAmount, `Receipt discount for order ${servedOrder.id} should match order.`).toBe(
        expectedDiscountAmount,
      );
      expect(receipt.serviceFeeAmount, `Receipt service fee for order ${servedOrder.id} should match order.`).toBe(
        expectedServiceFee,
      );
      expect(receipt.totalAmount, `Receipt total for order ${servedOrder.id} should match order.`).toBe(
        expectedTotal,
      );
      expect(receipt.paymentStatus, `Receipt for order ${servedOrder.id} should stay UNPAID.`).toBe('UNPAID');
      expect(receipt.payments, `Receipt for order ${servedOrder.id} should not include payments.`).toHaveLength(0);
    } finally {
      if (orderId) {
        const order = await getOrder(request, ownerHeaders, orderId).catch(() => null);
        if (order?.status && !['CLOSED', 'CANCELLED'].includes(order.status)) {
          await cancelOrder(request, ownerHeaders, order.id, 'E2E discount step-up UI cleanup').catch(
            () => undefined,
          );
        }
      }
      if (discountTable) {
        await resetOrderTable(request, ownerHeaders, discountTable).catch(() => undefined);
      }
    }
  });
});
