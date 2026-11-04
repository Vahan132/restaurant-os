import { DEFAULT_RESERVATION_DURATION_MIN } from '../../domain/entities/reservation';
import { ReservationRepository } from '../../domain/repositories/reservation.repository';

/**
 * Record-based double-booking check for a single table.
 *
 * Returns true when any ACTIVE (non-terminal) reservation assigned to `tableId`
 * has a [reservedAt, +duration) window that overlaps the given one. Mirrors the
 * availability query: candidates START before this window ends (repository), and
 * we keep those that have NOT yet ended (`existingEnd > start`). Two windows that
 * merely touch at a boundary (e.g. 20:00–21:30 and 21:30–23:00) do NOT overlap.
 *
 * Pass the reservation's own id as `excludeReservationId` when editing or
 * reassigning an existing reservation so it never conflicts with itself.
 *
 * This is the single source of truth for overlap enforcement — create,
 * assign-table, and update all call it so the rule cannot drift between paths.
 */
export async function tableHasOverlappingReservation(
  reservations: ReservationRepository,
  restaurantId: string,
  branchId: string,
  tableId: string,
  reservedAt: Date,
  durationMinutes: number | undefined,
  excludeReservationId?: string,
): Promise<boolean> {
  const startMs = reservedAt.getTime();
  const endMs = startMs + (durationMinutes ?? DEFAULT_RESERVATION_DURATION_MIN) * 60_000;
  const candidates = await reservations.findActiveOnTableBefore(
    restaurantId,
    branchId,
    tableId,
    new Date(endMs),
    excludeReservationId,
  );
  return candidates.some((r) => r.reservedAt.getTime() + r.durationMinutes * 60_000 > startMs);
}
