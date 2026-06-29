export const STOCK_ON_HAND_READER = Symbol('StockOnHandReader');

/** One on-hand row for an (item, location). */
export interface OnHandRow {
  itemId: string;
  itemName: string;
  baseUnit: string;
  locationId: string;
  locationName: string;
  quantity: number;
  /** Effective threshold (per-location override else item-level) — null if none. */
  lowStockThresholdBase: number | null;
  lowStock: boolean;
}

/**
 * Read model over the materialized StockOnHand projection (6A). Tenant-scoped by
 * restaurantId + branchId. On-hand is the denormalized projection maintained in
 * the same transaction as every ledger append (and rebuildable from the ledger).
 */
export interface StockOnHandReader {
  /** On-hand rows for one location. */
  byLocation(restaurantId: string, branchId: string, locationId: string): Promise<OnHandRow[]>;

  /** On-hand rows for one item across all its locations. */
  byItem(restaurantId: string, branchId: string, itemId: string): Promise<OnHandRow[]>;

  /** Current projected on-hand for one (item, location); 0 if no row yet. */
  quantityAt(restaurantId: string, branchId: string, itemId: string, locationId: string): Promise<number>;

  /** True if a location holds any non-zero on-hand (used to gate CUSTOM delete). */
  locationHasStock(restaurantId: string, branchId: string, locationId: string): Promise<boolean>;
}
