import type { APIRequestContext } from '@playwright/test';
import { ENV } from '../config/env';
import {
  createTable,
  getTable,
  listFloors,
  listTables,
  parseJsonBody,
  responseBodyText,
  type PosAuthHeaders,
  type TableResponse,
} from './order-requests';

export const ACTIVE_RESERVATION_STATUSES = new Set([
  'PENDING',
  'CONFIRMED',
  'ARRIVED',
  'SEATED',
]);

export interface ReservationResponse {
  id: string;
  restaurantId: string;
  branchId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  guestCount: number;
  reservedAt: string;
  durationMinutes: number;
  tableId: string | null;
  status: string;
  source: string;
  notes: string | null;
  customerNote: string | null;
  arrivedAt: string | null;
  seatedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledReason: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationListResponse {
  data: ReservationResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TableAvailabilityResponse {
  tableId: string;
  name: string;
  status: string;
  reservations: Array<{
    reservationId: string;
    customerName: string;
    reservedAt: string;
    durationMinutes: number;
    guestCount: number;
    status: string;
  }>;
}

export async function ensureReservationTable(
  request: APIRequestContext,
  auth: PosAuthHeaders,
): Promise<TableResponse> {
  const existing = (await listTables(request, auth)).find(
    (table) =>
      table.qrIdentifier === 'e2e-reservation-lifecycle' ||
      table.name === 'E2E Reservation Lifecycle',
  );
  if (existing) return existing;

  const floors = await listFloors(request, auth);
  const floor = floors.find((candidate) => candidate.status === 'ACTIVE') ?? floors[0];
  if (!floor) {
    throw new Error('Cannot create reservation lifecycle E2E table: GET /floors returned no floors.');
  }

  return createTable(request, auth, {
    floorId: floor.id,
    name: 'E2E Reservation Lifecycle',
    seatCapacity: 4,
    qrIdentifier: 'e2e-reservation-lifecycle',
  });
}

export async function createReservation(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  input: {
    customerName: string;
    customerPhone: string;
    guestCount: number;
    reservedAt: string;
    durationMinutes: number;
    tableId: string;
    notes?: string;
  },
): Promise<ReservationResponse> {
  const response = await request.post(`${ENV.apiBaseUrl}/reservations`, {
    headers: auth,
    data: input,
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(`POST /reservations failed: ${response.status()} ${text}`);
  }

  return parseJsonBody<ReservationResponse>(text, 'POST /reservations');
}

export async function getReservation(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  reservationId: string,
): Promise<ReservationResponse> {
  const response = await request.get(`${ENV.apiBaseUrl}/reservations/${encodeURIComponent(reservationId)}`, {
    headers: auth,
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(`GET /reservations/${reservationId} failed: ${response.status()} ${text}`);
  }

  return parseJsonBody<ReservationResponse>(text, `GET /reservations/${reservationId}`);
}

export async function listReservationsForTable(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  tableId: string,
): Promise<ReservationResponse[]> {
  const params = new URLSearchParams({ tableId, limit: '100' });
  const response = await request.get(`${ENV.apiBaseUrl}/reservations?${params.toString()}`, {
    headers: auth,
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(`GET /reservations?${params.toString()} failed: ${response.status()} ${text}`);
  }

  return parseJsonBody<ReservationListResponse>(text, `GET /reservations?${params.toString()}`).data;
}

export async function confirmReservation(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  reservationId: string,
): Promise<ReservationResponse> {
  return postReservationTransition(request, auth, reservationId, 'confirm');
}

export async function markReservationArrived(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  reservationId: string,
): Promise<ReservationResponse> {
  return postReservationTransition(request, auth, reservationId, 'arrive');
}

export async function cancelReservation(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  reservationId: string,
  reason: string,
): Promise<ReservationResponse> {
  const response = await request.post(
    `${ENV.apiBaseUrl}/reservations/${encodeURIComponent(reservationId)}/cancel`,
    {
      headers: auth,
      data: { reason },
      failOnStatusCode: false,
      ignoreHTTPSErrors: true,
    },
  );
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(`POST /reservations/${reservationId}/cancel failed: ${response.status()} ${text}`);
  }

  return parseJsonBody<ReservationResponse>(text, `POST /reservations/${reservationId}/cancel`);
}

export async function getReservationAvailability(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  input: { windowStart: string; windowEnd: string },
): Promise<TableAvailabilityResponse[]> {
  const params = new URLSearchParams({
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
  });
  const response = await request.get(`${ENV.apiBaseUrl}/reservations/availability?${params.toString()}`, {
    headers: auth,
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(`GET /reservations/availability?${params.toString()} failed: ${response.status()} ${text}`);
  }

  const body = parseJsonBody<unknown>(text, `GET /reservations/availability?${params.toString()}`);
  if (Array.isArray(body)) return body as TableAvailabilityResponse[];
  if (
    body &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    Array.isArray((body as { data?: unknown }).data)
  ) {
    return (body as { data: TableAvailabilityResponse[] }).data;
  }
  throw new Error(`GET /reservations/availability returned an unexpected shape: ${text}`);
}

export async function cancelActiveReservationsForTable(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  tableId: string,
  reason: string,
): Promise<ReservationResponse[]> {
  const reservations = await listReservationsForTable(request, auth, tableId);
  const cancelled: ReservationResponse[] = [];

  for (const reservation of reservations) {
    if (ACTIVE_RESERVATION_STATUSES.has(reservation.status)) {
      cancelled.push(await cancelReservation(request, auth, reservation.id, reason));
    }
  }

  return cancelled;
}

export async function getAvailabilityForTable(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  tableId: string,
  input: { windowStart: string; windowEnd: string },
): Promise<TableAvailabilityResponse> {
  const availability = await getReservationAvailability(request, auth, input);
  const table = availability.find((candidate) => candidate.tableId === tableId);
  if (!table) {
    throw new Error(`GET /reservations/availability did not include table ${tableId}.`);
  }
  return table;
}

export async function reloadTable(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  tableId: string,
): Promise<TableResponse> {
  return getTable(request, auth, tableId);
}

async function postReservationTransition(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  reservationId: string,
  action: 'confirm' | 'arrive',
): Promise<ReservationResponse> {
  const response = await request.post(
    `${ENV.apiBaseUrl}/reservations/${encodeURIComponent(reservationId)}/${action}`,
    {
      headers: auth,
      failOnStatusCode: false,
      ignoreHTTPSErrors: true,
    },
  );
  const text = await responseBodyText(response);

  if (!response.ok()) {
    throw new Error(`POST /reservations/${reservationId}/${action} failed: ${response.status()} ${text}`);
  }

  return parseJsonBody<ReservationResponse>(text, `POST /reservations/${reservationId}/${action}`);
}
