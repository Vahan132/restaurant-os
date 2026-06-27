/** Reservations domain enums (string values mirror the Prisma enum). Pure domain. */

/** How a reservation entered the system. Mirrors the Prisma ReservationSource enum. */
export enum ReservationSource {
  STAFF = 'STAFF',
  PUBLIC = 'PUBLIC',
  PHONE = 'PHONE',
}

/** Missed-call lifecycle. Mirrors the Prisma MissedCallStatus enum. */
export enum MissedCallStatus {
  NEW = 'NEW',
  HANDLED = 'HANDLED',
  DISMISSED = 'DISMISSED',
}

/** Registered call-device lifecycle. Mirrors the Prisma CallDeviceStatus enum. */
export enum CallDeviceStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
}

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
