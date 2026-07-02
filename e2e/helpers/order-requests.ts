import type { APIRequestContext } from '@playwright/test';
import { ENV, type SeededFixture } from '../config/env';
import type { KdsE2ESession, PosE2ESession } from './session';

const SEED_NOTE =
  'Run `pnpm db:seed` and then `pnpm db:seed:e2e` from the api workspace, then make sure e2e/fixtures/seeded.json is present on this machine.';

export interface CustomerOrderRequestFixture extends SeededFixture {
  restaurant?: { slug?: string };
  branch?: { id?: string; name?: string };
  table?: { id?: string; name?: string; qr?: string };
  dish?: {
    id?: string;
    name?: string;
    modifiers?: {
      donenessMedium?: string;
      sideFries?: string;
      [key: string]: unknown;
    };
  };
}

export interface PublicOrderRequestSummary {
  id: string;
  status: string;
}

export interface PublicOrderRequestResponse extends PublicOrderRequestSummary {
  rejectedReason?: string | null;
  items?: unknown[];
}

export interface StaffOrderRequestResponse extends PublicOrderRequestSummary {
  tableId: string;
  tableName?: string | null;
  linkedOrderId?: string | null;
  rejectedReason?: string | null;
}

export interface OrderResponse {
  id: string;
  tableId?: string | null;
  status?: string;
  orderNumber?: number | string;
  discountType?: string | null;
  discountValue?: number | null;
  paymentStatus?: string;
  paidAmount?: number;
  totals?: {
    subtotalAmount: number;
    discountAmount: number;
    serviceFeeAmount: number;
    totalAmount: number;
    currency: string;
  };
  items?: OrderItemResponse[];
  payments?: PaymentResponse[];
}

export interface OrderItemResponse {
  id: string;
  menuItemId: string;
  status: string;
  preparationStation?: string;
}

export interface PaymentResponse {
  id: string;
  branchId: string;
  method: string;
  amount: number;
  tenderedAmount: number | null;
  state: string;
  createdAt: string;
}

export interface ReceiptResponse {
  orderNumber: number;
  tableName: string | null;
  items: Array<{ name: string; qty: number; lineTotal: number }>;
  subtotalAmount: number;
  discountAmount: number;
  serviceFeeAmount: number;
  totalAmount: number;
  payments: Array<{ method: string; amount: number }>;
  paymentStatus: string;
  closedAt: string | null;
}

export interface TableResponse {
  id: string;
  restaurantId: string;
  branchId: string;
  floorId: string;
  name: string;
  seatCapacity: number;
  status: string;
  qrIdentifier: string | null;
}

export interface FloorResponse {
  id: string;
  restaurantId: string;
  branchId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  status: string;
}

export interface PosAuthHeaders extends Record<string, string> {
  authorization: string;
  'x-branch-id': string;
  'content-type': string;
}

export interface KdsAuthHeaders extends Record<string, string> {
  authorization: string;
  'x-branch-id': string;
  'x-device-secret': string;
  'content-type': string;
}

export interface KdsTicketResponse {
  orderId: string;
  orderNumber: number;
  tableName: string | null;
  items: KdsTicketItemResponse[];
}

export interface KdsTicketItemResponse {
  orderItemId: string;
  name: string;
  quantity: number;
  status: string;
}

export interface MenuTreeOption {
  id: string;
  name: string;
}

export interface MenuTreeGroup {
  id: string;
  name: string;
  required: boolean;
  minSelect: number | null;
  options: MenuTreeOption[];
}

export interface MenuTreeItem {
  id: string;
  name: string;
  preparationStation: string;
  availability: string;
  modifierGroups: MenuTreeGroup[];
}

export interface MenuTreeCategory {
  id: string;
  name: string;
  items: MenuTreeItem[];
}

interface ApiList<T> {
  data: T[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function unwrapApiBody<T>(body: unknown): T {
  if (isRecord(body) && 'data' in body && !('pagination' in body)) {
    return body.data as T;
  }
  return body as T;
}

export async function responseBodyText(response: { text: () => Promise<string> }): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    return `<failed to read body: ${error instanceof Error ? error.message : String(error)}>`;
  }
}

export function parseJsonBody<T>(text: string, context: string): T {
  try {
    return unwrapApiBody<T>(JSON.parse(text));
  } catch (error) {
    throw new Error(
      `${context} returned non-JSON or unexpected JSON: ${error instanceof Error ? error.message : String(error)}\n` +
        `Body: ${text}`,
    );
  }
}

function parseListBody<T>(text: string, context: string): T[] {
  const body = parseJsonBody<unknown>(text, context);
  if (Array.isArray(body)) return body as T[];
  if (isRecord(body) && Array.isArray(body.data)) return body.data as T[];
  if (isRecord(body) && Array.isArray(body.items)) return body.items as T[];

  throw new Error(`${context} returned an unexpected list shape: ${text}`);
}

export function requireCustomerOrderRequestFixture(fixture: CustomerOrderRequestFixture): {
  slug: string;
  tableId: string;
  tableName: string;
  qr: string;
  dishId: string;
  modifierOptionIds: string[];
} {
  const slug = fixture.restaurant?.slug;
  const tableId = fixture.table?.id;
  const tableName = fixture.table?.name;
  const qr = fixture.table?.qr;
  const dishId = fixture.dish?.id;
  const donenessMedium = fixture.dish?.modifiers?.donenessMedium;
  const sideFries = fixture.dish?.modifiers?.sideFries;

  const missing = [
    ['restaurant.slug', slug],
    ['table.id', tableId],
    ['table.name', tableName],
    ['table.qr', qr],
    ['dish.id', dishId],
    ['dish.modifiers.donenessMedium', donenessMedium],
    ['dish.modifiers.sideFries', sideFries],
  ]
    .filter(([, value]) => typeof value !== 'string' || value.length === 0)
    .map(([field]) => field);

  if (missing.length > 0) {
    throw new Error(
      `Invalid customer order-request E2E fixture: missing ${missing.join(', ')}.\n` +
        `fixture path: ${ENV.fixturesPath}\n` +
        SEED_NOTE,
    );
  }

  return {
    slug: slug as string,
    tableId: tableId as string,
    tableName: tableName as string,
    qr: qr as string,
    dishId: dishId as string,
    modifierOptionIds: [donenessMedium as string, sideFries as string],
  };
}

export async function createPendingCustomerOrderRequest(
  request: APIRequestContext,
  fixture: CustomerOrderRequestFixture,
): Promise<PublicOrderRequestSummary> {
  const required = requireCustomerOrderRequestFixture(fixture);
  const payload = {
    qr: required.qr,
    items: [
      {
        menuItemId: required.dishId,
        quantity: 1,
        modifiers: required.modifierOptionIds.map((modifierOptionId) => ({ modifierOptionId })),
      },
    ],
  };

  const response = await request.post(`${ENV.apiBaseUrl}/public/order-requests`, {
    headers: {
      'x-restaurant-slug': required.slug,
      'content-type': 'application/json',
    },
    data: payload,
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(
      [
        `POST /public/order-requests failed: ${response.status()} ${text}`,
        `table id/name: ${required.tableId} / ${required.tableName}`,
        `payload: ${JSON.stringify(payload)}`,
        SEED_NOTE,
      ].join('\n'),
    );
  }

  const body = parseJsonBody<PublicOrderRequestSummary>(text, 'POST /public/order-requests');
  if (!body.id || body.status !== 'PENDING') {
    throw new Error(`Unexpected public order-request create response: ${text}`);
  }
  return body;
}

export async function getPublicOrderRequest(
  request: APIRequestContext,
  fixture: CustomerOrderRequestFixture,
  id: string,
): Promise<PublicOrderRequestResponse> {
  const { slug, tableId, tableName } = requireCustomerOrderRequestFixture(fixture);
  const response = await request.get(
    `${ENV.apiBaseUrl}/public/order-requests/${encodeURIComponent(id)}`,
    {
      headers: { 'x-restaurant-slug': slug },
      failOnStatusCode: false,
      ignoreHTTPSErrors: true,
    },
  );
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(
      [
        `GET /public/order-requests/${id} failed: ${response.status()} ${text}`,
        `table id/name: ${tableId} / ${tableName}`,
      ].join('\n'),
    );
  }

  return parseJsonBody<PublicOrderRequestResponse>(
    text,
    `GET /public/order-requests/${id}`,
  );
}

type StorageStateSession = {
  storageState: {
    origins: Array<{ localStorage: Array<{ name: string; value: string }> }>;
  };
};

function getLocalStorageValue(session: StorageStateSession, storageKey: string): string {
  for (const origin of session.storageState.origins) {
    const item = origin.localStorage.find((entry) => entry.name === storageKey);
    if (item) return item.value;
  }
  throw new Error(`Could not find ${storageKey} in browser storage state.`);
}

export function posAuthHeaders(session: PosE2ESession): PosAuthHeaders {
  const auth = JSON.parse(getLocalStorageValue(session.pos, 'pos-auth')) as {
    state?: { accessToken?: unknown };
  };
  const branch = JSON.parse(getLocalStorageValue(session.pos, 'pos-branch')) as {
    state?: { activeBranchId?: unknown };
  };

  const accessToken = auth.state?.accessToken;
  const branchId = branch.state?.activeBranchId;
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new Error('Could not extract POS accessToken from storage state.');
  }
  if (typeof branchId !== 'string' || branchId.length === 0) {
    throw new Error('Could not extract POS activeBranchId from storage state.');
  }

  return {
    authorization: `Bearer ${accessToken}`,
    'x-branch-id': branchId,
    'content-type': 'application/json',
  };
}

export async function listPendingOrderRequests(
  request: APIRequestContext,
  auth: PosAuthHeaders,
): Promise<StaffOrderRequestResponse[]> {
  const response = await request.get(`${ENV.apiBaseUrl}/order-requests?status=PENDING&limit=100`, {
    headers: auth,
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(`GET /order-requests?status=PENDING&limit=100 failed: ${response.status()} ${text}`);
  }

  const body = parseJsonBody<ApiList<StaffOrderRequestResponse>>(
    text,
    'GET /order-requests?status=PENDING&limit=100',
  );
  return body.data;
}

export function kdsAuthHeaders(session: KdsE2ESession): KdsAuthHeaders {
  const auth = JSON.parse(getLocalStorageValue(session.kds, 'kds-auth')) as {
    state?: { accessToken?: unknown };
  };
  const branch = JSON.parse(getLocalStorageValue(session.kds, 'kds-branch')) as {
    state?: { branchId?: unknown };
  };

  const accessToken = auth.state?.accessToken;
  const branchId = branch.state?.branchId;
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new Error('Could not extract KDS accessToken from storage state.');
  }
  if (typeof branchId !== 'string' || branchId.length === 0) {
    throw new Error('Could not extract KDS branchId from storage state.');
  }

  return {
    authorization: `Bearer ${accessToken}`,
    'x-branch-id': branchId,
    'x-device-secret': session.kds.deviceSecret,
    'content-type': 'application/json',
  };
}

export async function confirmOrderRequest(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  requestId: string,
): Promise<OrderResponse> {
  const response = await request.post(
    `${ENV.apiBaseUrl}/order-requests/${encodeURIComponent(requestId)}/confirm`,
    {
      headers: auth,
      failOnStatusCode: false,
      ignoreHTTPSErrors: true,
    },
  );
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(`POST /order-requests/${requestId}/confirm failed: ${response.status()} ${text}`);
  }

  const body = parseJsonBody<OrderResponse>(
    text,
    `POST /order-requests/${requestId}/confirm`,
  );
  if (!body.id) {
    throw new Error(`Confirm response did not include an order id: ${text}`);
  }
  return body;
}

export async function listActiveOrdersForTable(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  tableId: string,
): Promise<OrderResponse[]> {
  const params = new URLSearchParams({ tableId, includeInactive: 'false', limit: '100' });
  const response = await request.get(`${ENV.apiBaseUrl}/orders?${params.toString()}`, {
    headers: auth,
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(`GET /orders?${params.toString()} failed: ${response.status()} ${text}`);
  }

  const body = parseJsonBody<ApiList<OrderResponse>>(text, `GET /orders?${params.toString()}`);
  return body.data;
}

export async function getOrder(
  request: APIRequestContext,
  auth: KdsAuthHeaders | PosAuthHeaders,
  orderId: string,
): Promise<OrderResponse> {
  const response = await request.get(`${ENV.apiBaseUrl}/orders/${encodeURIComponent(orderId)}`, {
    headers: auth,
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(`GET /orders/${orderId} failed: ${response.status()} ${text}`);
  }

  return parseJsonBody<OrderResponse>(text, `GET /orders/${orderId}`);
}

export async function createDineInOrder(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  tableId: string,
): Promise<OrderResponse> {
  const response = await request.post(`${ENV.apiBaseUrl}/orders`, {
    headers: auth,
    data: { type: 'DINE_IN', tableId },
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(`POST /orders failed: ${response.status()} ${text}`);
  }

  const body = parseJsonBody<OrderResponse>(text, 'POST /orders');
  if (!body.id) {
    throw new Error(`Create order response did not include an order id: ${text}`);
  }
  return body;
}

export async function addOrderItem(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  orderId: string,
  input: { menuItemId: string; quantity: number; selectedOptionIds?: string[] },
): Promise<OrderResponse> {
  const response = await request.post(`${ENV.apiBaseUrl}/orders/${encodeURIComponent(orderId)}/items`, {
    headers: auth,
    data: input,
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(`POST /orders/${orderId}/items failed: ${response.status()} ${text}`);
  }

  return parseJsonBody<OrderResponse>(text, `POST /orders/${orderId}/items`);
}

export async function sendOrderToKitchen(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  orderId: string,
): Promise<OrderResponse> {
  const response = await request.post(
    `${ENV.apiBaseUrl}/orders/${encodeURIComponent(orderId)}/send-to-kitchen`,
    {
      headers: auth,
      failOnStatusCode: false,
      ignoreHTTPSErrors: true,
    },
  );
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(`POST /orders/${orderId}/send-to-kitchen failed: ${response.status()} ${text}`);
  }

  return parseJsonBody<OrderResponse>(text, `POST /orders/${orderId}/send-to-kitchen`);
}

export async function markOrderServed(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  orderId: string,
): Promise<OrderResponse> {
  const response = await request.post(`${ENV.apiBaseUrl}/orders/${encodeURIComponent(orderId)}/serve`, {
    headers: auth,
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(`POST /orders/${orderId}/serve failed: ${response.status()} ${text}`);
  }

  return parseJsonBody<OrderResponse>(text, `POST /orders/${orderId}/serve`);
}

export async function getReceipt(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  orderId: string,
): Promise<ReceiptResponse> {
  const response = await request.get(`${ENV.apiBaseUrl}/orders/${encodeURIComponent(orderId)}/receipt`, {
    headers: auth,
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(`GET /orders/${orderId}/receipt failed: ${response.status()} ${text}`);
  }

  return parseJsonBody<ReceiptResponse>(text, `GET /orders/${orderId}/receipt`);
}

export async function listFloors(
  request: APIRequestContext,
  auth: PosAuthHeaders,
): Promise<FloorResponse[]> {
  const response = await request.get(`${ENV.apiBaseUrl}/floors?includeInactive=false`, {
    headers: auth,
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(`GET /floors failed: ${response.status()} ${text}`);
  }

  return parseListBody<FloorResponse>(text, 'GET /floors');
}

export async function listTables(
  request: APIRequestContext,
  auth: PosAuthHeaders,
): Promise<TableResponse[]> {
  const response = await request.get(`${ENV.apiBaseUrl}/tables`, {
    headers: auth,
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(`GET /tables failed: ${response.status()} ${text}`);
  }

  return parseListBody<TableResponse>(text, 'GET /tables');
}

export async function getMenuTree(
  request: APIRequestContext,
  auth: PosAuthHeaders,
): Promise<MenuTreeCategory[]> {
  const response = await request.get(`${ENV.apiBaseUrl}/menu?includeUnavailable=false`, {
    headers: auth,
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(`GET /menu?includeUnavailable=false failed: ${response.status()} ${text}`);
  }

  return parseListBody<MenuTreeCategory>(text, 'GET /menu?includeUnavailable=false');
}

export async function getTable(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  tableId: string,
): Promise<TableResponse> {
  const response = await request.get(`${ENV.apiBaseUrl}/tables/${encodeURIComponent(tableId)}`, {
    headers: auth,
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(`GET /tables/${tableId} failed: ${response.status()} ${text}`);
  }

  return parseJsonBody<TableResponse>(text, `GET /tables/${tableId}`);
}

export async function createTable(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  input: { floorId: string; name: string; seatCapacity: number; qrIdentifier?: string },
): Promise<TableResponse> {
  const response = await request.post(`${ENV.apiBaseUrl}/tables`, {
    headers: auth,
    data: input,
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(`POST /tables failed: ${response.status()} ${text}`);
  }

  return parseJsonBody<TableResponse>(text, 'POST /tables');
}

export async function changeTableStatus(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  tableId: string,
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING' | 'DISABLED',
): Promise<TableResponse> {
  const response = await request.patch(`${ENV.apiBaseUrl}/tables/${encodeURIComponent(tableId)}/status`, {
    headers: auth,
    data: { status },
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(`PATCH /tables/${tableId}/status failed: ${response.status()} ${text}`);
  }

  return parseJsonBody<TableResponse>(text, `PATCH /tables/${tableId}/status`);
}

export async function seededOwnerAuthHeaders(
  request: APIRequestContext,
  fixture: CustomerOrderRequestFixture,
): Promise<PosAuthHeaders> {
  const branchId = fixture.branch?.id;
  if (typeof branchId !== 'string' || branchId.length === 0) {
    throw new Error(
      `Invalid E2E fixture: missing branch.id for seeded owner cleanup auth.\n` +
        `fixture path: ${ENV.fixturesPath}`,
    );
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
    throw new Error(
      [
        `POST /auth/login for seeded owner cleanup failed: ${response.status()} ${text}`,
        'This cleanup path uses the standard seeded owner account only to clear stale active orders on the E2E table.',
        'If the seed password was changed with SEED_STAFF_PASSWORD, rerun/copy e2e/fixtures/seeded.json and update this E2E helper accordingly.',
      ].join('\n'),
    );
  }

  const body = parseJsonBody<{ accessToken?: string }>(text, 'POST /auth/login for seeded owner cleanup');
  if (typeof body.accessToken !== 'string' || body.accessToken.length === 0) {
    throw new Error(`Seeded owner login response did not include accessToken: ${text}`);
  }

  return {
    authorization: `Bearer ${body.accessToken}`,
    'x-branch-id': branchId,
    'content-type': 'application/json',
  };
}

export async function cancelOrder(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  orderId: string,
  reason: string,
): Promise<OrderResponse> {
  const response = await request.post(`${ENV.apiBaseUrl}/orders/${encodeURIComponent(orderId)}/cancel`, {
    headers: auth,
    data: { reason },
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(`POST /orders/${orderId}/cancel failed: ${response.status()} ${text}`);
  }

  const body = parseJsonBody<OrderResponse>(text, `POST /orders/${orderId}/cancel`);
  if (body.status !== 'CANCELLED') {
    throw new Error(`Cancel response for order ${orderId} did not return CANCELLED: ${text}`);
  }
  return body;
}

export async function moveOrderToTableRaw(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  orderId: string,
  tableId: string,
): Promise<{ status: number; ok: boolean; text: string }> {
  const response = await request.post(`${ENV.apiBaseUrl}/orders/${encodeURIComponent(orderId)}/move-table`, {
    headers: auth,
    data: { tableId },
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  return {
    status: response.status(),
    ok: response.ok(),
    text: await responseBodyText(response),
  };
}

export async function getStationTickets(
  request: APIRequestContext,
  auth: KdsAuthHeaders,
  station: string,
): Promise<KdsTicketResponse[]> {
  const response = await request.get(
    `${ENV.apiBaseUrl}/kds/stations/${encodeURIComponent(station)}/tickets`,
    {
      headers: auth,
      failOnStatusCode: false,
      ignoreHTTPSErrors: true,
    },
  );
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(`GET /kds/stations/${station}/tickets failed: ${response.status()} ${text}`);
  }

  const body = parseJsonBody<ApiList<KdsTicketResponse>>(
    text,
    `GET /kds/stations/${station}/tickets`,
  );
  return body.data;
}
