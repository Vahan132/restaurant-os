import { LowStockAlertStatus } from '../../domain/enums';

export const LOW_STOCK_ALERT_READER = Symbol('LowStockAlertReader');

/** One low-stock alert row for surfacing in the Admin UI. */
export interface LowStockAlertRow {
  id: string;
  itemId: string;
  itemName: string;
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
