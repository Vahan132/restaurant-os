import { test, expect, type APIRequestContext } from '@playwright/test';
import { expectApiHealth } from '../../helpers/health';
import {
  cancelOrder,
  changeTableStatus,
  createTable,
  listActiveOrdersForTable,
  listFloors,
  listTables,
  parseJsonBody,
  responseBodyText,
  seededOwnerAuthHeaders,
  type CustomerOrderRequestFixture,
  type PosAuthHeaders,
  type TableResponse,
} from '../../helpers/order-requests';
import { ENV } from '../../config/env';
import {
  ACTIVE_RESERVATION_STATUSES,
  cancelActiveReservationsForTable,
  cancelReservation,
  completeReservation,
  confirmReservation,
  createReservation,
  getAvailabilityForTable,
  getReservation,
  markReservationArrived,
  markReservationSeated,
  reloadTable,
} from '../../helpers/reservations';
import { readFixtures } from '../../helpers/session';

const RESERVATION_DURATION_MINUTES = 90;
const COMPLETED_RELEASE_TABLE_NAME = 'E2E Reservation Completed Release';
const COMPLETED_RELEASE_TABLE_QR = 'e2e-reservation-completed-release';

interface RestaurantSettingsResponse {
  allowManualTableStatus: boolean;
}

function futureReservationWindow(): {
  reservedAt: string;
  windowStart: string;
  windowEnd: string;
} {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 45);
  start.setUTCHours(16, 0, 0, 0);

  const end = new Date(start.getTime() + RESERVATION_DURATION_MINUTES * 60_000);
  return {
    reservedAt: start.toISOString(),
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
  };
}

async function ensureCompletedReleaseTable(
  request: APIRequestContext,
  auth: PosAuthHeaders,
): Promise<TableResponse> {
  const existing = (await listTables(request, auth)).find(
    (table) =>
      table.qrIdentifier === COMPLETED_RELEASE_TABLE_QR ||
      table.name === COMPLETED_RELEASE_TABLE_NAME,
  );
  if (existing) return existing;

  const floors = await listFloors(request, auth);
  const floor = floors.find((candidate) => candidate.status === 'ACTIVE') ?? floors[0];
  if (!floor) {
    throw new Error('Cannot create completed-release E2E table: GET /floors returned no floors.');
  }

  return createTable(request, auth, {
    floorId: floor.id,
    name: COMPLETED_RELEASE_TABLE_NAME,
    seatCapacity: 4,
    qrIdentifier: COMPLETED_RELEASE_TABLE_QR,
  });
}

async function resetCompletedReleaseTable(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  table: TableResponse,
): Promise<TableResponse> {
  await cancelActiveReservationsForTable(
    request,
    auth,
    table.id,
    'E2E completed-release setup cleanup',
  );

  const activeOrders = await listActiveOrdersForTable(request, auth, table.id);
  for (const order of activeOrders) {
    await cancelOrder(request, auth, order.id, 'E2E completed-release order cleanup');
  }

  const current = await reloadTable(request, auth, table.id);
  if (current.status === 'AVAILABLE') return current;

  return withManualTableStatus(request, auth, async () =>
    changeTableStatus(request, auth, table.id, 'AVAILABLE'),
  );
}

async function getRestaurantSettings(
  request: APIRequestContext,
  auth: PosAuthHeaders,
): Promise<RestaurantSettingsResponse> {
  const response = await request.get(`${ENV.apiBaseUrl}/restaurant/settings`, {
    headers: auth,
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  const text = await responseBodyText(response);
  if (!response.ok()) {
    throw new Error(`GET /restaurant/settings failed: ${response.status()} ${text}`);
  }
  return parseJsonBody<RestaurantSettingsResponse>(text, 'GET /restaurant/settings');
}

async function setManualTableStatus(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  allowManualTableStatus: boolean,
): Promise<void> {
  const response = await request.patch(`${ENV.apiBaseUrl}/restaurant/settings`, {
    headers: auth,
    data: { allowManualTableStatus },
    failOnStatusCode: false,
    ignoreHTTPSErrors: true,
  });
  const text = await responseBodyText(response);
  if (!response.ok()) {
    throw new Error(
      `PATCH /restaurant/settings allowManualTableStatus=${allowManualTableStatus} failed: ${response.status()} ${text}`,
    );
  }
}

async function withManualTableStatus<T>(
  request: APIRequestContext,
  auth: PosAuthHeaders,
  run: () => Promise<T>,
): Promise<T> {
  const original = await getRestaurantSettings(request, auth);
  const shouldRestore = !original.allowManualTableStatus;

  if (shouldRestore) {
    await setManualTableStatus(request, auth, true);
  }

  try {
    return await run();
  } finally {
    if (shouldRestore) {
      await setManualTableStatus(request, auth, false).catch(() => undefined);
    }
  }
}

test.describe('completed reservation table release behavior', () => {
  test('documents table and availability state after a seated reservation is completed', async ({
    request,
  }) => {
    const fixture = readFixtures() as CustomerOrderRequestFixture;

    await expectApiHealth(request, { label: 'primary API for completed reservation release' });

    const auth = await seededOwnerAuthHeaders(request, fixture);
    const table = await resetCompletedReleaseTable(
      request,
      auth,
      await ensureCompletedReleaseTable(request, auth),
    );
    expect(
      table.status,
      `Completed-release table ${table.id} must start AVAILABLE.`,
    ).toBe('AVAILABLE');

    const window = futureReservationWindow();
    const availabilityBefore = await getAvailabilityForTable(request, auth, table.id, window);
    expect(
      availabilityBefore.status,
      `Availability should show table ${table.id} as AVAILABLE before create.`,
    ).toBe('AVAILABLE');
    expect(
      availabilityBefore.reservations,
      `Availability should have no active overlapping reservations for table ${table.id} before create.`,
    ).toHaveLength(0);

    let reservationId: string | undefined;
    try {
      const created = await createReservation(request, auth, {
        customerName: 'E2E Reservation Completed Release',
        customerPhone: '+374 99 000002',
        guestCount: 2,
        reservedAt: window.reservedAt,
        durationMinutes: RESERVATION_DURATION_MINUTES,
        tableId: table.id,
        notes: 'Created by completed reservation release E2E',
      });
      reservationId = created.id;
      expect(created.status, `Reservation ${created.id} should start PENDING.`).toBe('PENDING');
      expect(created.tableId, `Reservation ${created.id} should be assigned to the E2E table.`).toBe(
        table.id,
      );

      const confirmed = await confirmReservation(request, auth, created.id);
      expect(confirmed.status, `Reservation ${created.id} should move PENDING -> CONFIRMED.`).toBe(
        'CONFIRMED',
      );

      const arrived = await markReservationArrived(request, auth, created.id);
      expect(arrived.status, `Reservation ${created.id} should move CONFIRMED -> ARRIVED.`).toBe(
        'ARRIVED',
      );
      expect(arrived.arrivedAt, `Reservation ${created.id} should record arrivedAt.`).toBeTruthy();

      const tableAfterArrive = await reloadTable(request, auth, table.id);
      expect(
        tableAfterArrive.status,
        `ARRIVED reservation ${created.id} should hold table ${table.id} as RESERVED.`,
      ).toBe('RESERVED');

      const availabilityAfterArrive = await getAvailabilityForTable(request, auth, table.id, window);
      expect(
        availabilityAfterArrive.status,
        `Availability should expose live RESERVED status for table ${table.id} after arrival.`,
      ).toBe('RESERVED');
      expect(
        availabilityAfterArrive.reservations.map((reservation) => reservation.reservationId),
        `Availability should include arrived reservation ${created.id}.`,
      ).toContain(created.id);
      expect(
        availabilityAfterArrive.reservations.find(
          (reservation) => reservation.reservationId === created.id,
        )?.status,
        `Availability should show reservation ${created.id} as ARRIVED.`,
      ).toBe('ARRIVED');

      const seated = await markReservationSeated(request, auth, created.id);
      expect(seated.status, `Reservation ${created.id} should move ARRIVED -> SEATED.`).toBe(
        'SEATED',
      );

      const tableAfterSeat = await reloadTable(request, auth, table.id);
      expect(
        tableAfterSeat.status,
        `SEATED reservation ${created.id} should occupy table ${table.id}.`,
      ).toBe('OCCUPIED');

      const completed = await completeReservation(request, auth, created.id);
      expect(completed.status, `Reservation ${created.id} should move SEATED -> COMPLETED.`).toBe(
        'COMPLETED',
      );
      expect(completed.completedAt, `Reservation ${created.id} should record completedAt.`).toBeTruthy();

      const tableAfterComplete = await reloadTable(request, auth, table.id);
      expect(
        tableAfterComplete.status,
        'COMPLETED intentionally does not release the table; the order/table flow owns OCCUPIED release.',
      ).toBe('OCCUPIED');

      const availabilityAfterComplete = await getAvailabilityForTable(request, auth, table.id, window);
      expect(
        availabilityAfterComplete.status,
        `Availability should expose live OCCUPIED status for table ${table.id} after completion.`,
      ).toBe('OCCUPIED');
      expect(
        availabilityAfterComplete.reservations.map((reservation) => reservation.reservationId),
        `Completed reservation ${created.id} should no longer block the reservation window.`,
      ).not.toContain(created.id);
    } finally {
      if (reservationId) {
        const reservation = await getReservation(request, auth, reservationId).catch(() => null);
        if (reservation && ACTIVE_RESERVATION_STATUSES.has(reservation.status)) {
          await cancelReservation(request, auth, reservation.id, 'E2E completed-release cleanup');
        }
      }

      await resetCompletedReleaseTable(request, auth, table).catch(() => undefined);
    }
  });
});
