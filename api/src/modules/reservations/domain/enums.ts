/** Reservations domain enums (string values mirror the Prisma enum). Pure domain. */

export enum ReservationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  ARRIVED = 'ARRIVED',
  SEATED = 'SEATED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

/** Terminal statuses — no further transitions allowed. */
export const TERMINAL_RESERVATION_STATUSES: ReadonlySet<ReservationStatus> = new Set([
  ReservationStatus.COMPLETED,
  ReservationStatus.CANCELLED,
  ReservationStatus.NO_SHOW,
]);

/** Active (non-terminal) statuses — a reservation that may still hold a table plan. */
export const ACTIVE_RESERVATION_STATUSES: ReadonlySet<ReservationStatus> = new Set([
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
  ReservationStatus.ARRIVED,
  ReservationStatus.SEATED,
]);
