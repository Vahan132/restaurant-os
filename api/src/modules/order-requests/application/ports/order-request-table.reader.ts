export const ORDER_REQUEST_TABLE_READER = Symbol('OrderRequestTableReader');

/** Resolves a table by its QR identifier WITHIN a restaurant (tenant-scoped). */
export interface OrderRequestTableReader {
  resolveTableIdByQr(restaurantId: string, qrIdentifier: string): Promise<string | null>;
  /** Names for the given table ids (staff list display). */
  tableNames(restaurantId: string, tableIds: string[]): Promise<Map<string, string>>;
}
