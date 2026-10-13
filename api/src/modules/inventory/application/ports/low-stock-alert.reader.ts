import { CatalogLocalizedName } from '../../../platform-catalog/domain/repositories/catalog-item.reader';
import { LowStockAlertStatus } from '../../domain/enums';

export const LOW_STOCK_ALERT_READER = Symbol('LowStockAlertReader');

/** One low-stock alert row for surfacing in the Admin UI. */
export interface LowStockAlertRow {
  id: string;
  itemId: string;
  /** Local name; null for an adopted item (PLATCAT-ADOPT-1B). Use catalogName then. */
  itemName: string | null;
  /** PLATCAT-ADOPT-1B: InventoryItem.catalogItemId — drives live name resolution. */
  catalogItemId: string | null;
  /** Live-resolved trilingual catalog name; present when adopted (filled by the use-case). */
  catalogName?: CatalogLocalizedName | null;
  locationId: string;
  locationName: string;
  thresholdBase: number;
  onHandBase: number;
  status: LowStockAlertStatus;
  raisedAt: Date;
  resolvedAt: Date | null;
}

/** Read model over the low-stock alert table (6A). Tenant + branch scoped. */
export interface LowStockAlertReader {
  list(input: {
    restaurantId: string;
    branchId: string;
    status?: LowStockAlertStatus;
    skip: number;
    take: number;
  }): Promise<{ rows: LowStockAlertRow[]; total: number }>;
}
