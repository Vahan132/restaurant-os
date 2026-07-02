import { test, expect } from '@playwright/test';
import { ENV } from '../../config/env';
import { expectApiHealth } from '../../helpers/health';
import {
  changeTableStatus,
  seededOwnerAuthHeaders,
  type CustomerOrderRequestFixture,
  type PosAuthHeaders,
  type TableResponse,
} from '../../helpers/order-requests';
import {
  ACTIVE_RESERVATION_STATUSES,
  cancelActiveReservationsForTable,
  cancelReservation,
  confirmReservation,
  createReservation,
  ensureReservationTable,
  getAvailabilityForTable,
  getReservation,
  markReservationArrived,
  reloadTable,
} from '../../helpers/reservations';
import { readFixtures } from '../../helpers/session';

const RESERVATION_DURATION_MINUTES = 90;

function futureReservationWindow(): {
  reservedAt: string;
  windowStart: string;
  windowEnd: string;
} {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 30);
  start.setUTCHours(15, 0, 0, 0);

  const end = new Date(start.getTime() + RESERVATION_DURATION_MINUTES * 60_000);
  return {
    reservedAt: start.toISOString(),
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
  };
}

async function resetReservationTable(
  request: Parameters<typeof cancelActiveReservationsForTable>[0],
  auth: PosAuthHeaders,
  table: TableResponse,
): Promise<TableResponse> {
  await cancelActiveReservationsForTable(
    request,
    auth,
    table.id,
    'E2E reservation lifecycle setup cleanup',
  );

  const current = await reloadTable(request, auth, table.id);
  if (current.status === 'CLEANING' || current.status === 'DISABLED') {
    return changeTableStatus(request, auth, table.id, 'AVAILABLE');
  }

  return current;
}

test.describe('reservation lifecycle API', () => {
  test('syncs assigned table state and availability from arrival through cancellation', async ({
    request,
  }) => {
    const fixture = readFixtures() as CustomerOrderRequestFixture;

    await expectApiHealth(request, { label: 'primary API for reservation lifecycle' });

    const auth = await seededOwnerAuthHeaders(request, fixture);
    const table = await resetReservationTable(
      request,
      auth,
      await ensureReservationTable(request, auth),
    );
    expect(
      table.status,
      `Reservation lifecycle table ${table.id} must start AVAILABLE.`,
    ).toBe('AVAILABLE');

    const window = futureReservationWindow();
    const availabilityBefore = await getAvailabilityForTable(request, auth, table.id, window);
    expect(availabilityBefore.status, `Availability should show table ${table.id} as AVAILABLE before create.`).toBe(
      'AVAILABLE',
    );
    expect(
      availabilityBefore.reservations,
      `Availability should have no active overlapping reservations for table ${table.id} before create.`,
    ).toHaveLength(0);

    let reservationId: string | undefined;
    try {
      const created = await createReservation(request, auth, {
        customerName: 'E2E Reservation Lifecycle',
        customerPhone: '+374 99 000001',
        guestCount: 2,
        reservedAt: window.reservedAt,
        durationMinutes: RESERVATION_DURATION_MINUTES,
        tableId: table.id,
        notes: 'Created by reservation lifecycle E2E',
      });
      reservationId = created.id;

      expect(created.status, `Reservation ${created.id} should use the real initial status.`).toBe(
        'PENDING',
      );
      expect(created.tableId, `Reservation ${created.id} should be assigned to the E2E table.`).toBe(
        table.id,
      );
      expect(created.reservedAt, `Reservation ${created.id} should use the requested future slot.`).toBe(
        window.reservedAt,
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
        `Availability should include active arrived reservation ${created.id}.`,
      ).toContain(created.id);
      expect(
        availabilityAfterArrive.reservations.find(
          (reservation) => reservation.reservationId === created.id,
        )?.status,
        `Availability should show reservation ${created.id} as ARRIVED.`,
      ).toBe('ARRIVED');

      const cancelled = await cancelReservation(
        request,
        auth,
        created.id,
        'E2E reservation lifecycle cancellation',
      );
      expect(cancelled.status, `Reservation ${created.id} should move ARRIVED -> CANCELLED.`).toBe(
        'CANCELLED',
      );
      expect(cancelled.cancelledReason, `Reservation ${created.id} should store cancel reason.`).toBe(
        'E2E reservation lifecycle cancellation',
      );

      const tableAfterCancel = await reloadTable(request, auth, table.id);
      expect(
        tableAfterCancel.status,
        `CANCELLED reservation ${created.id} should release table ${table.id}.`,
      ).toBe('AVAILABLE');

      const availabilityAfterCancel = await getAvailabilityForTable(request, auth, table.id, window);
      expect(
        availabilityAfterCancel.status,
        `Availability should expose live AVAILABLE status for table ${table.id} after cancellation.`,
      ).toBe('AVAILABLE');
      expect(
        availabilityAfterCancel.reservations.map((reservation) => reservation.reservationId),
        `Availability should no longer include cancelled reservation ${created.id}.`,
      ).not.toContain(created.id);
    } finally {
      if (reservationId) {
        const reservation = await getReservation(request, auth, reservationId).catch(() => null);
        if (reservation && ACTIVE_RESERVATION_STATUSES.has(reservation.status)) {
          await cancelReservation(request, auth, reservation.id, 'E2E reservation lifecycle cleanup');
        }
      }

      await resetReservationTable(request, auth, table);
    }
  });
});
