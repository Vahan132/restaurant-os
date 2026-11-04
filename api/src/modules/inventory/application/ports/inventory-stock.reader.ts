import { CatalogLocalizedName } from '../../../platform-catalog/domain/repositories/catalog-item.reader';
import { ItemKind } from '../../domain/enums';

export const INVENTORY_STOCK_READER = Symbol('InventoryStockReader');

export interface StockFilter {
  restaurantId: string;
  branchId: string;
  lowStock?: boolean;
  expiringBefore?: Date;
  categoryId?: string;
  kind?: ItemKind;
  search?: string;
  /**
   * INV-SEARCH-1: catalog item ids matched by the search term (resolved in the use-case
   * via CatalogBrowseReader). When `search` is set, rows match on local `name` OR
   * `catalogItemId in` this set, so adopted items are findable by their live catalog name.
   */
  matchedCatalogItemIds?: string[];
}

/** One row of the stock/valuation read model. */
export interface StockRow {
  itemId: string;
  /** Local name; null for an adopted item (PLATCAT-ADOPT-1B). Use catalogName then. */
  name: string | null;
  /** PLATCAT-ADOPT-1B: InventoryItem.catalogItemId — drives live name resolution. */
  catalogItemId: string | null;
  /** Live-resolved trilingual catalog name; present when adopted (filled by the use-case). */
  catalogName?: CatalogLocalizedName | null;
  sku: string | null;
  categoryId: string | null;
  kind: ItemKind;
  baseUnit: string;
  /** Sum of movement.baseQty (may be negative). */
  onHandBase: number;
  /** Sum over OPEN layers of round(lineTotalCostAmount * remaining / received). */
  valuationAmount: number;
  lowStockThresholdBase: number | null;
  lowStock: boolean;
  earliestExpiry: Date | null;
}

/**
 * Read model for stock on-hand + valuation and layer visibility. Implemented in
 * infrastructure with Prisma aggregation; tenant-scoped by restaurantId.
 */
export interface InventoryStockReader {
  /**
   * INV-SEARCH-1: returns the FULL filtered set (lowStock / expiry applied), UNSORTED
   * and UNPAGINATED. The use-case resolves effective names, sorts, then slices — adopted
   * rows carry a null local `name` that can't be ordered in SQL.
   */
  stock(filter: StockFilter): Promise<StockRow[]>;
}
