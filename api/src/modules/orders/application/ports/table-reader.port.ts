export const ORDERS_TABLE_READER = Symbol('OrdersTableReader');

/** Reads a table's branch (orders module's view of the tables context). */
export interface OrdersTableReader {
  /**
   * Returns the table's branchId, or null when the table does not exist in the
   * restaurant. Callers compare it against the order's branch to reject
   * cross-branch references (intra-branch integrity).
   */
  getTableBranchId(restaurantId: string, tableId: string): Promise<string | null>;
}
