export const TABLE_LOCATOR = Symbol('TableLocator');

export interface TableRef {
  tableId: string;
  /** The branch that owns the table (BR-4). */
  branchId: string;
}

/** Resolves a table (id + owning branch) within a restaurant (tenant-scoped). */
export interface TableLocator {
  /** Resolve a table by its scanned QR identifier, or null if not found. */
  resolveByQr(restaurantId: string, qrIdentifier: string): Promise<TableRef | null>;
  /** The owning branch of a table by id, or null if not in this restaurant. */
  getBranchId(restaurantId: string, tableId: string): Promise<string | null>;
}
