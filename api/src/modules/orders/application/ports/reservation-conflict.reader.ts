export const ORDERS_RESERVATION_READER = Symbol('OrdersReservationReader');

/** Reads reservation holds on a table (orders module's view of the reservations context). */
export interface OrdersReservationReader {
  /**
   * True when the table is currently held by an active (non-terminal) reservation
   * whose reserved window [reservedAt, reservedAt + durationMinutes) contains `at`.
   *
   * Mirrors the [reservedAt, +duration) overlap used by the reservations
   * availability query, evaluated at the instant `at`. Far-future reservations
   * (guest not due yet) and past/terminal ones do NOT count as a live hold.
   */
  hasActiveReservationHold(
    restaurantId: string,
    branchId: string,
    tableId: string,
    at: Date,
  ): Promise<boolean>;
}
