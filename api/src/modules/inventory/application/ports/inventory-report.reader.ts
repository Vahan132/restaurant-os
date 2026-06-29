export const INVENTORY_REPORT_READER = Symbol('InventoryReportReader');

/** Branch scope + optional narrowing filters shared by the stock reports. */
export interface ReportScopeFilter {
  restaurantId: string;
  /** The branches the caller may see (already resolved + access-checked). */
  branchIds: string[];
  locationId?: string;
  itemId?: string;
  categoryId?: string;
}

/** One on-hand row per (item, location) with its FIFO value. */
export interface StockOnHandReportRow {
  branchId: string;
  locationId: string;
  locationName: string;
  itemId: string;
  itemName: string;
  sku: string | null;
  categoryId: string | null;
  baseUnit: string;
  /** On-hand in base units (may be negative). */
  quantity: number;
  /**
   * FIFO value (minor units): Σ over OPEN layers (remaining × unit cost) when
   * quantity >= 0; the negative shortfall valued at last known unit cost when < 0.
   */
  valuationAmount: number;
  /** Effective threshold (per-location override else item-level), null if none. */
  lowStockThresholdBase: number | null;
  lowStock: boolean;
}

export interface StockOnHandReport {
  rows: StockOnHandReportRow[];
  total: number;
  /** Sum of valuationAmount over ALL matched rows (not just the page). */
  totalValuationAmount: number;
}

/** A valuation roll-up bucket (per location or per branch). */
export interface ValuationBucket {
  branchId: string;
  /** Null for a per-branch bucket. */
  locationId: string | null;
  /** Null for a per-branch bucket. */
  locationName: string | null;
  valuationAmount: number;
}

export interface ValuationSummary {
  byLocation: ValuationBucket[];
  byBranch: ValuationBucket[];
  /** Aggregate across every in-scope branch. */
  totalValuationAmount: number;
}

/**
 * Read model for the inventory stock reports (6D). Reads from the projections
 * (StockOnHand + StockLayer); the ledger remains the source of truth. Scoped to
 * an explicit set of branchIds (branch isolation is resolved by the caller).
 */
export interface InventoryReportReader {
  /** Per-(item, location) on-hand + FIFO value (paginated). */
  stockOnHand(
    filter: ReportScopeFilter & { lowStockOnly?: boolean; skip: number; take: number },
  ): Promise<StockOnHandReport>;

  /** Valuation roll-ups: per location, per branch, and aggregate. */
  valuationSummary(filter: ReportScopeFilter): Promise<ValuationSummary>;

  /** Items at/below their low-stock threshold, per (item, location). */
  lowStock(filter: ReportScopeFilter): Promise<StockOnHandReportRow[]>;

  /** Items currently negative at a location (the correction worklist). */
  negativeStock(filter: ReportScopeFilter): Promise<StockOnHandReportRow[]>;
}
