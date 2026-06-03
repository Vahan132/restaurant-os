export const TABLE_STATUS_GATEWAY = Symbol('TableStatusGateway');

/**
 * Outbound port to the tables context. The infra adapter delegates to the
 * tables module's exported TableStatusService (SYSTEM transitions).
 */
export interface TableStatusGateway {
  markOccupied(restaurantId: string, tableId: string): Promise<void>;
  markAvailable(restaurantId: string, tableId: string): Promise<void>;
  markCleaning(restaurantId: string, tableId: string): Promise<void>;
}
