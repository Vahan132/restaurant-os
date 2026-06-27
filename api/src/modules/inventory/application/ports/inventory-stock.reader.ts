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
  skip: number;
  take: number;
}

/** One row of the stock/valuation read model. */
export interface StockRow {
  itemId: string;
  name: string;
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
  stock(filter: StockFilter): Promise<{ rows: StockRow[]; total: number }>;
}
