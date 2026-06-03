import { ReservationStatus } from './enums';

/**
 * Reservation STATUS state machine:
 *   PENDING   -> CONFIRMED, CANCELLED, NO_SHOW
 *   CONFIRMED -> ARRIVED, CANCELLED, NO_SHOW
 *   ARRIVED   -> SEATED, NO_SHOW, CANCELLED
 *   SEATED    -> COMPLETED, CANCELLED
 *   terminal: COMPLETED, CANCELLED, NO_SHOW
 */
export const RESERVATION_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  [ReservationStatus.PENDING]: [
    ReservationStatus.CONFIRMED,
    ReservationStatus.CANCELLED,
    ReservationStatus.NO_SHOW,
  ],
  [ReservationStatus.CONFIRMED]: [
    ReservationStatus.ARRIVED,
    ReservationStatus.CANCELLED,
    ReservationStatus.NO_SHOW,
  ],
  [ReservationStatus.ARRIVED]: [
    ReservationStatus.SEATED,
    ReservationStatus.NO_SHOW,
    ReservationStatus.CANCELLED,
  ],
  [ReservationStatus.SEATED]: [ReservationStatus.COMPLETED, ReservationStatus.CANCELLED],
  [ReservationStatus.COMPLETED]: [],
  [ReservationStatus.CANCELLED]: [],
  [ReservationStatus.NO_SHOW]: [],
};

export function isValidReservationTransition(
  from: ReservationStatus,
  to: ReservationStatus,
): boolean {
  return RESERVATION_TRANSITIONS[from]?.includes(to) ?? false;
}
