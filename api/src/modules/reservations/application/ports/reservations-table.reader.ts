export const RESERVATIONS_TABLE_READER = Symbol('ReservationsTableReader');

export interface ActiveTableInfo {
  id: string;
  name: string;
  status: string; // TableStatus
}

export interface ReservationsTableRef {
  /** TableStatus string. */
  status: string;
  /** The branch that owns the table (BR-4). Used to reject cross-branch assignment. */
  branchId: string;
}

/** Reads table existence/status for reservations (tenant-scoped). */
export interface ReservationsTableReader {
  /** Current TableStatus string, or null if the table is not in this restaurant. */
  findTableStatus(restaurantId: string, tableId: string): Promise<string | null>;
  /**
   * The table's current status + owning branch, or null if not in this restaurant.
   * Used to validate intra-branch table assignment (BR-5 §6).
   */
  findTableRef(restaurantId: string, tableId: string): Promise<ReservationsTableRef | null>;
  /** Active (non-deleted) tables in the branch with their current live status. */
  listActiveTables(restaurantId: string, branchId: string): Promise<ActiveTableInfo[]>;
}
