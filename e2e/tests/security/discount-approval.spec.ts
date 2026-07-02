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
  type PosAuthHeaders,
  type TableResponse,
} from '../../helpers/order-requests';
import { readFixtures } from '../../helpers/session';

const STAFF_PASSWORD = 'ChangeMe123!';
const DISCOUNT_TABLE_NAME = 'E2E Discount Approval';
const DISCOUNT_TABLE_QR = 'e2e-discount-approval';
const DISCOUNT_TYPE = 'PERCENT';
const DISCOUNT_VALUE_BPS = 1000;

interface DiscountApprovalFixture extends CustomerOrderRequestFixture {
  pos?: { deviceSecret?: string; userId?: string; pin?: string; fullName?: string };
}

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: { required?: string[]; missing?: string[] };
  };
  code?: string;
  message?: string;
  details?: { required?: string[]; missing?: string[] };
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
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

interface PinLoginResponse {
  accessToken: string;
  refreshToken?: string;
  branchId: string;
  mustRotate?: boolean;
  user: { id: string; email: string; fullName: string };
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

function requireFixtureString(
  value: unknown,
  field: string,
  fixturePath = ENV.fixturesPath,
): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid discount-approval E2E fixture: missing ${field}.\nfixture path: ${fixturePath}`);
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

function errorCode(text: string, context: string): string | undefined {
  const body = parseJsonBody<ApiErrorBody>(text, context);
  return body.error?.code ?? body.code;
}

function applyBpsHalfUp(amount: number, bps: number): number {
  return Math.floor((amount * bps + 5000) / 10000);
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
  return parseJsonBody<MyBranchAccessResponse>(
    response.text,
    `GET /branches/${branchId}/my-access`,
  );
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
    throw new Error(`Cannot create discount-approval table ${input.name}: GET /floors returned no floors.`);
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
    await cancelOrder(request, auth, order.id, 'E2E discount approval setup cleanup');
  }

  const remaining = await listActiveOrdersForTable(request, auth, table.id);
  expect(
    remaining,
    `Discount-approval setup could not clear active orders for table ${table.id}.`,
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
  fixture: DiscountApprovalFixture,
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

  expect(served.status, `Prepared order ${created.id} should be SERVED.`).toBe('SERVED');
  expect(served.paymentStatus, `Prepared order ${created.id} should start unpaid.`).toBe('UNPAID');
  expect(served.discountType, `Prepared order ${created.id} should start with no discount type.`).toBeNull();
  expect(served.discountValue, `Prepared order ${created.id} should start with no discount value.`).toBeNull();
  expect(served.totals?.discountAmount, `Prepared order ${created.id} should start undiscounted.`).toBe(0);
  expect(served.totals?.subtotalAmount, `Prepared order ${created.id} subtotal should be positive.`).toBeGreaterThan(0);
  expect(served.totals?.totalAmount, `Prepared order ${created.id} total should be positive.`).toBeGreaterThan(0);
  return served;
}

test.describe('POS discount manager approval', () => {
  test('waiter cannot apply discount without manager approval', async ({ request }) => {
    const fixture = readFixtures() as DiscountApprovalFixture;
    const branchId = requireFixtureString(fixture.branch?.id, 'branch.id');
    const deviceSecret = requireFixtureString(fixture.pos?.deviceSecret, 'pos.deviceSecret');
    const waiterUserId = requireFixtureString(fixture.pos?.userId, 'pos.userId');
    const waiterPin = requireFixtureString(fixture.pos?.pin, 'pos.pin');

    await expectApiHealth(request, { label: 'primary API for POS discount approval' });

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

      const discountPayload = { type: DISCOUNT_TYPE, value: DISCOUNT_VALUE_BPS };
      const waiterDiscount = await requestText(
        request,
        'post',
        `${ENV.apiBaseUrl}/orders/${encodeURIComponent(servedOrder.id)}/discount`,
        {
          headers: waiterHeaders,
          data: discountPayload,
        },
      );
      expect(waiterDiscount.status, `WAITER discount should require approval: ${waiterDiscount.text}`).toBe(403);
      expect(errorCode(waiterDiscount.text, 'POST /orders/:id/discount as WAITER without approval')).toBe(
        'DISCOUNT_AUTHORIZATION_REQUIRED',
      );

      const afterWaiter = await getOrder(request, ownerHeaders, servedOrder.id);
      expect(afterWaiter.discountType, 'WAITER must not set discount type without approval.').toBeNull();
      expect(afterWaiter.discountValue, 'WAITER must not set discount value without approval.').toBeNull();
      expect(afterWaiter.totals?.subtotalAmount, 'WAITER rejection must not change subtotal.').toBe(
        originalTotals.subtotalAmount,
      );
      expect(afterWaiter.totals?.discountAmount, 'WAITER rejection must not apply discount.').toBe(0);
      expect(afterWaiter.totals?.serviceFeeAmount, 'WAITER rejection must not change service fee.').toBe(
        originalTotals.serviceFeeAmount,
      );
      expect(afterWaiter.totals?.totalAmount, 'WAITER rejection must not change total.').toBe(
        originalTotals.totalAmount,
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

      const expectedDiscountAmount = applyBpsHalfUp(originalTotals.subtotalAmount, DISCOUNT_VALUE_BPS);
      const expectedDiscountedSubtotal = originalTotals.subtotalAmount - expectedDiscountAmount;
      const expectedServiceFee = applyBpsHalfUp(expectedDiscountedSubtotal, settings.serviceFeeRateBps);
      const expectedTotal = expectedDiscountedSubtotal + expectedServiceFee;

      const approvedDiscount = await requestText(
        request,
        'post',
        `${ENV.apiBaseUrl}/orders/${encodeURIComponent(servedOrder.id)}/discount`,
        {
          headers: waiterHeaders,
          data: {
            ...discountPayload,
            authorization: { deviceSecret, pin: managerPin.pin },
          },
        },
      );
      expect(
        approvedDiscount.ok,
        `WAITER discount with MANAGER step-up failed: ${approvedDiscount.status} ${approvedDiscount.text}`,
      ).toBeTruthy();
      const approvedOrder = parseJsonBody<OrderResponse>(
        approvedDiscount.text,
        'POST /orders/:id/discount as WAITER with MANAGER step-up',
      );
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
      expect(approvedOrder.paymentStatus, 'Approved discount should leave the unpaid order unpaid.').toBe('UNPAID');
      expect(approvedOrder.paidAmount, 'Approved discount should not create a payment.').toBe(0);

      const afterApproval = await getOrder(request, ownerHeaders, servedOrder.id);
      expect(afterApproval.discountType, 'Saved order discount type should match approved response.').toBe(
        DISCOUNT_TYPE,
      );
      expect(afterApproval.discountValue, 'Saved order discount value should match approved response.').toBe(
        DISCOUNT_VALUE_BPS,
      );
      expect(afterApproval.totals?.discountAmount, 'Saved order discount amount should persist.').toBe(
        expectedDiscountAmount,
      );
      expect(afterApproval.totals?.totalAmount, 'Saved order total should persist.').toBe(expectedTotal);

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
          await cancelOrder(request, ownerHeaders, order.id, 'E2E discount approval cleanup').catch(
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
