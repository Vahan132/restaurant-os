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

const STAFF_PASSWORD = 'ChangeMe123!';
const PAYMENT_TABLE_NAME = 'E2E Payment Permissions';
const PAYMENT_TABLE_QR = 'e2e-payment-permissions';
const CASHIER_CREATE_TABLE_NAME = 'E2E Payment Permissions Cashier Create';
const CASHIER_CREATE_TABLE_QR = 'e2e-payment-permissions-cashier-create';

interface PaymentPermissionsFixture extends CustomerOrderRequestFixture {
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
  branchId: string;
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

function requireFixtureString(
  value: unknown,
  field: string,
  fixturePath = ENV.fixturesPath,
): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid payment-permissions E2E fixture: missing ${field}.\nfixture path: ${fixturePath}`);
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

function parseError(text: string, context: string): ApiErrorBody {
  return parseJsonBody<ApiErrorBody>(text, context);
}

function errorCode(text: string, context: string): string | undefined {
  const body = parseError(text, context);
  return body.error?.code ?? body.code;
}

function activePayments(order: OrderResponse): PaymentResponse[] {
  return (order.payments ?? []).filter((payment) => payment.state === 'ACTIVE');
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
    throw new Error(`Cannot create payment-permissions table ${input.name}: GET /floors returned no floors.`);
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
    await cancelOrder(request, auth, order.id, 'E2E payment permissions setup cleanup');
  }

  const remaining = await listActiveOrdersForTable(request, auth, table.id);
  expect(
    remaining,
    `Payment-permissions setup could not clear active orders for table ${table.id}.`,
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
  fixture: PaymentPermissionsFixture,
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
  expect(served.totals?.totalAmount, `Prepared order ${created.id} total should be positive.`).toBeGreaterThan(0);
  return served;
}

test.describe('POS payment permissions', () => {
  test('waiter cannot process payment, cashier can, and cashier cannot create dine-in orders', async ({
    request,
  }) => {
    const fixture = readFixtures() as PaymentPermissionsFixture;
    const branchId = requireFixtureString(fixture.branch?.id, 'branch.id');
    const deviceSecret = requireFixtureString(fixture.pos?.deviceSecret, 'pos.deviceSecret');
    const waiterUserId = requireFixtureString(fixture.pos?.userId, 'pos.userId');
    const waiterPin = requireFixtureString(fixture.pos?.pin, 'pos.pin');

    await expectApiHealth(request, { label: 'primary API for POS payment permissions' });

    const ownerLogin = await loginOwner(request);
    const ownerHeaders = authHeaders(ownerLogin.accessToken, branchId);

    let paymentTable: TableResponse | undefined;
    let cashierCreateTable: TableResponse | undefined;
    let orderId: string | undefined;

    try {
      paymentTable = await resetOrderTable(
        request,
        ownerHeaders,
        await ensureTable(request, ownerHeaders, {
          name: PAYMENT_TABLE_NAME,
          qr: PAYMENT_TABLE_QR,
        }),
      );
      cashierCreateTable = await resetOrderTable(
        request,
        ownerHeaders,
        await ensureTable(request, ownerHeaders, {
          name: CASHIER_CREATE_TABLE_NAME,
          qr: CASHIER_CREATE_TABLE_QR,
        }),
      );

      const servedOrder = await prepareServedOrder(request, ownerHeaders, paymentTable, fixture);
      orderId = servedOrder.id;
      const totalAmount = servedOrder.totals?.totalAmount;
      expect(totalAmount, `Prepared order ${servedOrder.id} has no totalAmount.`).toBeGreaterThan(0);

      const waiterLogin = await pinLogin(
        request,
        { deviceSecret, userId: waiterUserId, pin: waiterPin },
        'WAITER',
      );
      expect(waiterLogin.branchId, 'Waiter PIN login should bind to the fixture branch.').toBe(branchId);
      const waiterHeaders = authHeaders(waiterLogin.accessToken, branchId);
      const waiterAccess = await getMyBranchAccess(request, waiterHeaders, branchId);
      expect(waiterAccess.permissions, 'Seeded WAITER should not have PAYMENT_PROCESS.').not.toContain(
        'PAYMENT_PROCESS',
      );

      const waiterPayment = await requestText(
        request,
        'post',
        `${ENV.apiBaseUrl}/orders/${encodeURIComponent(servedOrder.id)}/payments`,
        {
          headers: waiterHeaders,
          data: { method: 'CASH', amount: totalAmount, tenderedAmount: totalAmount },
        },
      );
      expect(waiterPayment.status, `WAITER payment should be forbidden: ${waiterPayment.text}`).toBe(403);
      expect(errorCode(waiterPayment.text, 'POST /orders/:id/payments as WAITER')).toBe(
        'INSUFFICIENT_PERMISSIONS',
      );

      const waiterClose = await requestText(
        request,
        'post',
        `${ENV.apiBaseUrl}/orders/${encodeURIComponent(servedOrder.id)}/close`,
        { headers: waiterHeaders },
      );
      expect(waiterClose.status, `WAITER close should be forbidden: ${waiterClose.text}`).toBe(403);
      expect(errorCode(waiterClose.text, 'POST /orders/:id/close as WAITER')).toBe(
        'INSUFFICIENT_PERMISSIONS',
      );

      const afterWaiter = await getOrder(request, ownerHeaders, servedOrder.id);
      expect(afterWaiter.status, 'WAITER must not close the order.').toBe('SERVED');
      expect(afterWaiter.paymentStatus, 'WAITER must not pay the order.').toBe('UNPAID');
      expect(afterWaiter.paidAmount, 'WAITER must not add paid amount.').toBe(0);
      expect(activePayments(afterWaiter), 'WAITER must not create an active payment.').toHaveLength(0);
      const tableAfterWaiter = await getTable(request, ownerHeaders, paymentTable.id);
      expect(tableAfterWaiter.status, 'Table should remain occupied while payment is rejected.').toBe(
        'OCCUPIED',
      );

      const staff = await listStaffForDevice(request, deviceSecret);
      const cashier = staff.find((entry) => entry.roleCode === 'CASHIER');
      if (!cashier) {
        throw new Error(`Could not find a CASHIER in staff picker. Entries: ${JSON.stringify(staff)}`);
      }
      const cashierPin = await resetStaffPin(request, ownerLogin.accessToken, cashier.id);
      const cashierLogin = await pinLogin(
        request,
        { deviceSecret, userId: cashier.id, pin: cashierPin.pin },
        'CASHIER',
      );
      expect(cashierLogin.branchId, 'Cashier PIN login should bind to the fixture branch.').toBe(branchId);
      const cashierHeaders = authHeaders(cashierLogin.accessToken, branchId);
      const cashierAccess = await getMyBranchAccess(request, cashierHeaders, branchId);
      expect(cashierAccess.permissions, 'Seeded CASHIER should have PAYMENT_PROCESS.').toContain(
        'PAYMENT_PROCESS',
      );
      expect(cashierAccess.permissions, 'Seeded CASHIER should not have ORDER_CREATE.').not.toContain(
        'ORDER_CREATE',
      );

      const activeBeforeCashierCreate = await listActiveOrdersForTable(
        request,
        ownerHeaders,
        cashierCreateTable.id,
      );
      expect(activeBeforeCashierCreate, 'Cashier order-create table should start with no active orders.').toHaveLength(0);
      const cashierCreateOrder = await requestText(request, 'post', `${ENV.apiBaseUrl}/orders`, {
        headers: cashierHeaders,
        data: { type: 'DINE_IN', tableId: cashierCreateTable.id },
      });
      expect(
        cashierCreateOrder.status,
        `CASHIER dine-in order creation should be forbidden: ${cashierCreateOrder.text}`,
      ).toBe(403);
      expect(errorCode(cashierCreateOrder.text, 'POST /orders as CASHIER')).toBe(
        'INSUFFICIENT_PERMISSIONS',
      );
      const activeAfterCashierCreate = await listActiveOrdersForTable(
        request,
        ownerHeaders,
        cashierCreateTable.id,
      );
      expect(activeAfterCashierCreate, 'CASHIER must not create a new active order.').toHaveLength(0);

      const cashierPayment = await requestText(
        request,
        'post',
        `${ENV.apiBaseUrl}/orders/${encodeURIComponent(servedOrder.id)}/payments`,
        {
          headers: cashierHeaders,
          data: { method: 'CASH', amount: totalAmount, tenderedAmount: totalAmount },
        },
      );
      expect(cashierPayment.ok, `CASHIER payment failed: ${cashierPayment.status} ${cashierPayment.text}`).toBeTruthy();
      const paymentBody = parseJsonBody<RecordPaymentResponse>(
        cashierPayment.text,
        'POST /orders/:id/payments as CASHIER',
      );
      expect(paymentBody.payment.method, 'CASHIER payment method should be cash.').toBe('CASH');
      expect(paymentBody.payment.amount, 'CASHIER payment amount should equal total.').toBe(totalAmount);
      expect(paymentBody.payment.tenderedAmount, 'CASHIER tendered amount should equal total.').toBe(totalAmount);
      expect(paymentBody.order.paymentStatus, 'CASHIER full payment should mark order paid.').toBe('PAID');

      const cashierClose = await requestText(
        request,
        'post',
        `${ENV.apiBaseUrl}/orders/${encodeURIComponent(servedOrder.id)}/close`,
        { headers: cashierHeaders },
      );
      expect(cashierClose.ok, `CASHIER close failed: ${cashierClose.status} ${cashierClose.text}`).toBeTruthy();

      const closedOrder = await getOrder(request, ownerHeaders, servedOrder.id);
      expect(closedOrder.status, `Order ${servedOrder.id} should be CLOSED.`).toBe('CLOSED');
      expect(closedOrder.paymentStatus, `Order ${servedOrder.id} should be PAID.`).toBe('PAID');
      expect(closedOrder.paidAmount, `Order ${servedOrder.id} paidAmount should equal total.`).toBe(totalAmount);
      expect(closedOrder.totals?.totalAmount, `Order ${servedOrder.id} total changed unexpectedly.`).toBe(totalAmount);

      const payments = activePayments(closedOrder);
      expect(payments, `Order ${servedOrder.id} should have exactly one active payment.`).toHaveLength(1);
      expect(payments[0].amount, `Order ${servedOrder.id} payment amount should equal total.`).toBe(totalAmount);
      expect(payments[0].tenderedAmount, `Order ${servedOrder.id} tendered amount should equal total.`).toBe(totalAmount);

      const receipt = await getReceipt(request, cashierHeaders, servedOrder.id);
      expect(receipt.paymentStatus, `Receipt for order ${servedOrder.id} should be PAID.`).toBe('PAID');
      expect(receipt.totalAmount, `Receipt total for order ${servedOrder.id} should match order total.`).toBe(totalAmount);
      expect(receipt.payments, `Receipt for order ${servedOrder.id} should include one payment.`).toHaveLength(1);
      expect(receipt.payments[0].amount, `Receipt payment for order ${servedOrder.id} should equal total.`).toBe(totalAmount);
      expect(receipt.closedAt, `Receipt for order ${servedOrder.id} should include closedAt.`).toBeTruthy();

      const tableAfterClose = await getTable(request, ownerHeaders, paymentTable.id);
      expect(tableAfterClose.status, `Payment table ${paymentTable.id} should move to CLEANING after close.`).toBe(
        'CLEANING',
      );
      const activeAfterClose = await listActiveOrdersForTable(request, ownerHeaders, paymentTable.id);
      expect(activeAfterClose, `Payment table ${paymentTable.id} should have no active orders after close.`).toHaveLength(0);
    } finally {
      if (orderId) {
        const order = await getOrder(request, ownerHeaders, orderId).catch(() => null);
        if (order?.status && !['CLOSED', 'CANCELLED'].includes(order.status)) {
          await cancelOrder(request, ownerHeaders, order.id, 'E2E payment permissions cleanup').catch(
            () => undefined,
          );
        }
      }
      if (paymentTable) {
        await resetOrderTable(request, ownerHeaders, paymentTable).catch(() => undefined);
      }
      if (cashierCreateTable) {
        await resetOrderTable(request, ownerHeaders, cashierCreateTable).catch(() => undefined);
      }
    }
  });
});
