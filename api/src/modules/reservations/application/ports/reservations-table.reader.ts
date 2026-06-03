export const RESERVATIONS_TABLE_READER = Symbol('ReservationsTableReader');

export interface ActiveTableInfo {
  id: string;
  name: string;
  status: string; // TableStatus
}

/** Reads table existence/status for reservations (tenant-scoped). */
export interface ReservationsTableReader {
  /** Current TableStatus string, or null if the table is not in this restaurant. */
  findTableStatus(restaurantId: string, tableId: string): Promise<string | null>;
  /** Active (non-deleted) tables with their current live status. */
  listActiveTables(restaurantId: string): Promise<ActiveTableInfo[]>;
}
