export const TABLE_STATUS_GATEWAY = Symbol('ReservationsTableStatusGateway');

/**
 * Outbound port to the tables context. The infra adapter delegates to the tables
 * module's exported TableStatusService (SYSTEM transitions). Reservation table
 * effects are auto-mode only and best-effort — callers check the live status first.
 */
export interface TableStatusGateway {
  markReserved(restaurantId: string, tableId: string): Promise<void>;
  markOccupied(restaurantId: string, tableId: string): Promise<void>;
  releaseReservation(restaurantId: string, tableId: string): Promise<void>;
}
