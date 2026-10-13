import { CatalogLocalizedName } from '../../../platform-catalog/domain/repositories/catalog-item.reader';

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
  /** Local name; null for an adopted item (PLATCAT-ADOPT-1B). Use catalogName then. */
  itemName: string | null;
  /** PLATCAT-ADOPT-1B: InventoryItem.catalogItemId — drives live name resolution. */
  catalogItemId: string | null;
  /** Live-resolved trilingual catalog name; present when adopted (filled by the use-case). */
  catalogName?: CatalogLocalizedName | null;
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
  /**
   * INV-SEARCH-1: the FULL filtered set (lowStockOnly applied), UNSORTED + UNPAGINATED.
   * The use-case resolves effective names, sorts, then slices the page — adopted rows
   * carry a null local `itemName` that can't be ordered in SQL.
   */
  rows: StockOnHandReportRow[];
  /** Count over ALL matched rows (not just a page). */
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
  /**
   * Per-(item, location) on-hand + FIFO value. Returns the full filtered set; the
   * use-case sorts by resolved name and paginates (INV-SEARCH-1).
   */
  stockOnHand(filter: ReportScopeFilter & { lowStockOnly?: boolean }): Promise<StockOnHandReport>;

  /** Valuation roll-ups: per location, per branch, and aggregate. */
  valuationSummary(filter: ReportScopeFilter): Promise<ValuationSummary>;

  /** Items at/below their low-stock threshold, per (item, location). */
  lowStock(filter: ReportScopeFilter): Promise<StockOnHandReportRow[]>;

  /** Items currently negative at a location (the correction worklist). */
  negativeStock(filter: ReportScopeFilter): Promise<StockOnHandReportRow[]>;
}
