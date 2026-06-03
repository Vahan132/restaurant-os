export const ORDERS_TABLE_READER = Symbol('OrdersTableReader');

/** Verifies a table belongs to the restaurant. Impl in infrastructure. */
export interface OrdersTableReader {
  tableExists(restaurantId: string, tableId: string): Promise<boolean>;
}
