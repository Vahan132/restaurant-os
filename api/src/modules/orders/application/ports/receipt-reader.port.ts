export const RECEIPT_READER = Symbol('ReceiptReader');

/** Header/footer/name fields a receipt needs (from Restaurant + RestaurantSettings + User + Table). */
export interface ReceiptMeta {
  restaurantName: string;
  address: string | null;
  phone: string | null;
  footer: string | null;
  servedByName: string | null;
  tableName: string | null;
}

/** Reads receipt metadata. Impl in infrastructure (tenant-scoped). */
export interface ReceiptReader {
  /** waiterId is null for QR-web customer orders (no "served by"). */
  get(restaurantId: string, waiterId: string | null, tableId: string | null): Promise<ReceiptMeta>;
}
