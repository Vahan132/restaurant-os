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
  seededOwnerAuthHeaders,
  sendOrderToKitchen,
  type CustomerOrderRequestFixture,
  type OrderResponse,
  type PosAuthHeaders,
  type TableResponse,
} from '../../helpers/order-requests';
import { readFixtures } from '../../helpers/session';

const STAFF_PASSWORD = 'ChangeMe123!';
const YEREVAN_TABLE_NAME = 'E2E Branch Isolation Yerevan';
const YEREVAN_TABLE_QR = 'e2e-branch-isolation-yerevan';

const ACTIVE_ORDER_STATUSES = new Set([
  'DRAFT',
  'SENT_TO_KITCHEN',
  'PREPARING',
  'READY',
  'SERVED',
]);

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
  code?: string;
  message?: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; fullName: string };
}

interface MeResponse {
  allBranches: boolean;
  accessibleBranches: Array<{ id: string; name: string; isDefault: boolean; permissions: string[] }>;
}

interface EnrollDeviceResponse {
  device: { id: string; branchId: string; surface: string; status: string };
  secret: string;
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

interface ListOrdersResponse {
  data: OrderResponse[];
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

function authHeaders(accessToken: string, branchId: string): PosAuthHeaders {
  return {
    authorization: `Bearer ${accessToken}`,
    'x-branch-id': branchId,
    'content-type': 'application/json',
  };
}

function errorCode(text: string): string | undefined {
  const body = parseJsonBody<ApiErrorBody>(text, 'API error response');
  return body.error?.code ?? body.code;
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

async function getMe(request: APIRequestContext, accessToken: string): Promise<MeResponse> {
  const response = await requestText(request, 'get', `${ENV.apiBaseUrl}/auth/me`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`GET /auth/me failed: ${response.status} ${response.text}`);
  }
  return parseJsonBody<MeResponse>(response.text, 'GET /auth/me');
}

async function enrollPosDevice(
  request: APIRequestContext,
  ownerHeaders: PosAuthHeaders,
): Promise<EnrollDeviceResponse> {
  const response = await requestText(request, 'post', `${ENV.apiBaseUrl}/devices`, {
    headers: ownerHeaders,
    data: { surface: 'POS', label: 'E2E Branch Isolation POS' },
  });
  if (!response.ok) {
    throw new Error(`POST /devices failed: ${response.status} ${response.text}`);
  }
  return parseJsonBody<EnrollDeviceResponse>(response.text, 'POST /devices');
}

async function revokeDevice(
  request: APIRequestContext,
  ownerHeaders: PosAuthHeaders,
  deviceId: string,
): Promise<void> {
  const response = await requestText(
    request,
    'post',
    `${ENV.apiBaseUrl}/devices/${encodeURIComponent(deviceId)}/revoke`,
    { headers: ownerHeaders },
  );
  if (!response.ok) {
    throw new Error(`POST /devices/${deviceId}/revoke failed: ${response.status} ${response.text}`);
  }
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
): Promise<PinLoginResponse> {
  const response = await requestText(request, 'post', `${ENV.apiBaseUrl}/auth/pin-login`, {
    headers: { 'content-type': 'application/json' },
    data: input,
  });
  if (!response.ok) {
    throw new Error(`POST /auth/pin-login failed: ${response.status} ${response.text}`);
  }
  return parseJsonBody<PinLoginResponse>(response.text, 'POST /auth/pin-login');
}

async function ensureYerevanTable(
  request: APIRequestContext,
  ownerYerevanHeaders: PosAuthHeaders,
): Promise<TableResponse> {
  const existing = (await listTables(request, ownerYerevanHeaders)).find(
    (table) => table.qrIdentifier === YEREVAN_TABLE_QR || table.name === YEREVAN_TABLE_NAME,
  );
  if (existing) return existing;

  const floors = await listFloors(request, ownerYerevanHeaders);
  const floor = floors.find((candidate) => candidate.status === 'ACTIVE') ?? floors[0];
  if (!floor) {
    throw new Error('Cannot create branch-isolation Yerevan table: GET /floors returned no floors.');
  }

  return createTable(request, ownerYerevanHeaders, {
    floorId: floor.id,
    name: YEREVAN_TABLE_NAME,
    seatCapacity: 2,
    qrIdentifier: YEREVAN_TABLE_QR,
  });
}

async function resetOrderTable(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  table: TableResponse,
): Promise<TableResponse> {
  const activeOrders = await listActiveOrdersForTable(request, auth, table.id);
  for (const order of activeOrders) {
    await cancelOrder(request, auth, order.id, 'E2E branch isolation setup cleanup');
  }

  const remaining = await listActiveOrdersForTable(request, auth, table.id);
  expect(
    remaining,
    `Branch-isolation setup could not clear active orders for Yerevan table ${table.id}.`,
  ).toHaveLength(0);

  const current = await getTable(request, auth, table.id);
  if (current.status === 'CLEANING' || current.status === 'DISABLED') {
    return changeTableStatus(request, auth, table.id, 'AVAILABLE');
  }
  return current;
}

async function createActiveYerevanOrder(
  request: APIRequestContext,
  ownerYerevanHeaders: PosAuthHeaders,
  tableId: string,
  fixture: CustomerOrderRequestFixture,
): Promise<OrderResponse> {
  const dish = requireCustomerOrderRequestFixture(fixture);
  const order = await createDineInOrder(request, ownerYerevanHeaders, tableId);
  await addOrderItem(request, ownerYerevanHeaders, order.id, {
    menuItemId: dish.dishId,
    quantity: 1,
    selectedOptionIds: dish.modifierOptionIds,
  });
  return sendOrderToKitchen(request, ownerYerevanHeaders, order.id);
}

test.describe('branch isolation API', () => {
  test('hides and rejects Yerevan orders and tables for Gyumri branch staff', async ({
    request,
  }) => {
    const fixture = readFixtures() as CustomerOrderRequestFixture;
    const yerevanBranchId = fixture.branch?.id;
    if (!yerevanBranchId) {
      throw new Error('Invalid E2E fixture: missing flagship/Yerevan branch id.');
    }

    await expectApiHealth(request, { label: 'primary API for branch isolation' });

    const ownerLogin = await loginOwner(request);
    const ownerMe = await getMe(request, ownerLogin.accessToken);
    expect(ownerMe.allBranches, 'Owner control account should have all-branch access.').toBeTruthy();

    const gyumriBranch = ownerMe.accessibleBranches.find((branch) => branch.id !== yerevanBranchId);
    if (!gyumriBranch) {
      throw new Error(
        `Could not find a non-Yerevan branch in /auth/me. Yerevan branch id: ${yerevanBranchId}`,
      );
    }

    const ownerYerevanHeaders = authHeaders(ownerLogin.accessToken, yerevanBranchId);
    const ownerGyumriHeaders = authHeaders(ownerLogin.accessToken, gyumriBranch.id);
    const seededOwnerYerevanHeaders = await seededOwnerAuthHeaders(request, fixture);

    const device = await enrollPosDevice(request, ownerGyumriHeaders);
    let orderId: string | undefined;
    try {
      expect(device.device.branchId, 'Temporary POS device should be enrolled at Gyumri.').toBe(
        gyumriBranch.id,
      );
      const staff = await listStaffForDevice(request, device.secret);
      const gyumriWaiter = staff.find((entry) => entry.roleCode === 'WAITER');
      if (!gyumriWaiter) {
        throw new Error(
          `Could not find a WAITER in Gyumri staff picker. Entries: ${JSON.stringify(staff)}`,
        );
      }

      const issuedPin = await resetStaffPin(request, ownerLogin.accessToken, gyumriWaiter.id);
      const gyumriLogin = await pinLogin(request, {
        deviceSecret: device.secret,
        userId: gyumriWaiter.id,
        pin: issuedPin.pin,
      });
      expect(gyumriLogin.branchId, 'PIN login should bind Gyumri waiter to Gyumri branch.').toBe(
        gyumriBranch.id,
      );

      const gyumriHeaders = authHeaders(gyumriLogin.accessToken, gyumriBranch.id);
      const gyumriSpoofYerevanHeaders = authHeaders(gyumriLogin.accessToken, yerevanBranchId);

      const table = await resetOrderTable(
        request,
        ownerYerevanHeaders,
        await ensureYerevanTable(request, ownerYerevanHeaders),
      );
      expect(table.status, `Yerevan branch-isolation table ${table.id} should start AVAILABLE.`).toBe(
        'AVAILABLE',
      );

      const order = await createActiveYerevanOrder(request, ownerYerevanHeaders, table.id, fixture);
      orderId = order.id;
      expect(order.tableId, `Control Yerevan order ${order.id} should be on Yerevan table.`).toBe(
        table.id,
      );
      expect(order.status, `Control Yerevan order ${order.id} should be active.`).toBe(
        'SENT_TO_KITCHEN',
      );

      const ownerOrder = await getOrder(request, seededOwnerYerevanHeaders, order.id);
      const ownerTable = await getTable(request, seededOwnerYerevanHeaders, table.id);
      expect(ownerOrder.id, 'Owner control should read the Yerevan order.').toBe(order.id);
      expect(ownerTable.id, 'Owner control should read the Yerevan table.').toBe(table.id);

      const gyumriList = await requestText(request, 'get', `${ENV.apiBaseUrl}/orders?limit=100`, {
        headers: gyumriHeaders,
      });
      expect(gyumriList.ok, `Gyumri staff should be able to list Gyumri orders: ${gyumriList.text}`).toBeTruthy();
      expect(
        parseJsonBody<ListOrdersResponse>(gyumriList.text, 'GET /orders as Gyumri').data.map(
          (candidate) => candidate.id,
        ),
        `Gyumri order list should not leak Yerevan order ${order.id}.`,
      ).not.toContain(order.id);

      const gyumriTables = await requestText(request, 'get', `${ENV.apiBaseUrl}/tables`, {
        headers: gyumriHeaders,
      });
      expect(gyumriTables.ok, `Gyumri staff should be able to list Gyumri tables: ${gyumriTables.text}`).toBeTruthy();
      expect(
        parseListResponse<TableResponse>(gyumriTables.text, 'GET /tables as Gyumri').map(
          (candidate) => candidate.id,
        ),
        `Gyumri table list should not leak Yerevan table ${table.id}.`,
      ).not.toContain(table.id);

      const spoofList = await requestText(request, 'get', `${ENV.apiBaseUrl}/orders?limit=100`, {
        headers: gyumriSpoofYerevanHeaders,
      });
      expect(spoofList.status, `Gyumri staff should not activate Yerevan branch: ${spoofList.text}`).toBe(
        403,
      );
      expect(errorCode(spoofList.text), 'Wrong-branch header should be rejected by branch guard.').toBe(
        'BRANCH_ACCESS_DENIED',
      );

      const getCrossBranchOrder = await requestText(
        request,
        'get',
        `${ENV.apiBaseUrl}/orders/${encodeURIComponent(order.id)}`,
        { headers: gyumriHeaders },
      );
      expect(
        getCrossBranchOrder.status,
        `Gyumri staff should not read Yerevan order ${order.id}: ${getCrossBranchOrder.text}`,
      ).toBe(404);
      expect(errorCode(getCrossBranchOrder.text), 'Cross-branch order read should be hidden.').toBe(
        'ORDER_NOT_FOUND',
      );

      const serveCrossBranchOrder = await requestText(
        request,
        'post',
        `${ENV.apiBaseUrl}/orders/${encodeURIComponent(order.id)}/serve`,
        { headers: gyumriHeaders },
      );
      expect(
        serveCrossBranchOrder.status,
        `Gyumri staff should not modify Yerevan order status ${order.id}: ${serveCrossBranchOrder.text}`,
      ).toBe(404);
      expect(errorCode(serveCrossBranchOrder.text), 'Cross-branch order status write should be hidden.').toBe(
        'ORDER_NOT_FOUND',
      );

      const moveCrossBranchOrder = await requestText(
        request,
        'post',
        `${ENV.apiBaseUrl}/orders/${encodeURIComponent(order.id)}/move-table`,
        {
          headers: gyumriHeaders,
          data: { tableId: table.id },
        },
      );
      expect(
        moveCrossBranchOrder.status,
        `Gyumri staff should not move Yerevan order ${order.id}: ${moveCrossBranchOrder.text}`,
      ).toBe(404);
      expect(errorCode(moveCrossBranchOrder.text), 'Cross-branch move-table should be hidden.').toBe(
        'ORDER_NOT_FOUND',
      );

      const getCrossBranchTable = await requestText(
        request,
        'get',
        `${ENV.apiBaseUrl}/tables/${encodeURIComponent(table.id)}`,
        { headers: gyumriHeaders },
      );
      expect(
        getCrossBranchTable.status,
        `Gyumri staff should not read Yerevan table ${table.id}: ${getCrossBranchTable.text}`,
      ).toBe(404);
      expect(errorCode(getCrossBranchTable.text), 'Cross-branch table read should be hidden.').toBe(
        'TABLE_NOT_FOUND',
      );

      const updateCrossBranchTable = await requestText(
        request,
        'patch',
        `${ENV.apiBaseUrl}/tables/${encodeURIComponent(table.id)}/status`,
        {
          headers: gyumriHeaders,
          data: { status: 'DISABLED' },
        },
      );
      expect(
        updateCrossBranchTable.status,
        `Gyumri staff should not modify Yerevan table ${table.id}: ${updateCrossBranchTable.text}`,
      ).toBe(404);
      expect(errorCode(updateCrossBranchTable.text), 'Cross-branch table write should be hidden.').toBe(
        'TABLE_NOT_FOUND',
      );

      const orderAfterAttempts = await getOrder(request, ownerYerevanHeaders, order.id);
      const tableAfterAttempts = await getTable(request, ownerYerevanHeaders, table.id);
      expect(orderAfterAttempts.tableId, 'Yerevan order should remain assigned to Yerevan table.').toBe(
        table.id,
      );
      expect(orderAfterAttempts.status, 'Yerevan order status should not be modified by Gyumri staff.').toBe(
        'SENT_TO_KITCHEN',
      );
      expect(tableAfterAttempts.status, 'Yerevan table status should not be modified by Gyumri staff.').toBe(
        'OCCUPIED',
      );
    } finally {
      if (orderId) {
        const order = await getOrder(request, ownerYerevanHeaders, orderId).catch(() => null);
        if (order?.status && ACTIVE_ORDER_STATUSES.has(order.status)) {
          await cancelOrder(request, ownerYerevanHeaders, order.id, 'E2E branch isolation cleanup');
        }
      }

      const table = await ensureYerevanTable(request, ownerYerevanHeaders).catch(() => null);
      if (table) {
        await resetOrderTable(request, ownerYerevanHeaders, table);
      }

      await revokeDevice(request, ownerGyumriHeaders, device.device.id).catch(() => undefined);
    }
  });
});
