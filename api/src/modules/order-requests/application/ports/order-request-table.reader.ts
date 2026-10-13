export const ORDER_REQUEST_TABLE_READER = Symbol('OrderRequestTableReader');

export interface OrderRequestTableRef {
  tableId: string;
  /** The branch that owns the table (BR-4). A request's branch = its table's branch. */
  branchId: string;
}

/** Resolves a table by its QR identifier WITHIN a restaurant (tenant-scoped). */
export interface OrderRequestTableReader {
  resolveTableIdByQr(restaurantId: string, qrIdentifier: string): Promise<string | null>;
  /**
   * Resolve a table (id + owning branch) by QR identifier, or null if not found.
   * The branch is used as the transient branch on order-request events.
   */
  resolveTableRefByQr(
    restaurantId: string,
    qrIdentifier: string,
  ): Promise<OrderRequestTableRef | null>;
  /** The owning branch of a table by id, or null if not in this restaurant. */
  getTableBranchId(restaurantId: string, tableId: string): Promise<string | null>;
  /** Names for the given table ids (staff list display). */
  tableNames(restaurantId: string, tableIds: string[]): Promise<Map<string, string>>;
}
