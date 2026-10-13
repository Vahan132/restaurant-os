import { BranchScope } from '../../domain/repositories/sales-import.repository';

/** DI token for the ImportedSalesAnalyticsReader port. */
export const IMPORTED_SALES_ANALYTICS_READER = Symbol('ImportedSalesAnalyticsReader');

export interface ImportedSalesFilter {
  restaurantId: string;
  /** Inclusive lower bound on `occurredAt`. */
  from: Date;
  /** Exclusive upper bound on `occurredAt`. */
  to: Date;
  scope: BranchScope;
}

export interface ImportedSalesSummary {
  totalRevenueAmount: number;
  saleCount: number;
  totalQuantity: number;
}

export interface ImportedItemRow {
  itemId: string | null;
  itemDescription: string;
  quantity: number;
  revenueAmount: number;
}

export interface ImportedTimeSeriesBucket {
  bucket: string;
  revenueAmount: number;
  saleCount: number;
}

export interface ImportedPaymentMethodRow {
  method: string;
  amount: number;
}

/**
 * Read port for the IMPORTED-SALES analytics surface. Reads EXCLUSIVELY from the
 * `imported_sales` table — completely separate from the orders-based fiscal
 * reports, which never see imported data under any filter. Branch-scoped.
 */
export interface ImportedSalesAnalyticsReader {
  /** Restaurant IANA timezone (for day boundaries + buckets). */
  timezone(restaurantId: string): Promise<string>;
  summary(filter: ImportedSalesFilter): Promise<ImportedSalesSummary>;
  byItem(filter: ImportedSalesFilter): Promise<ImportedItemRow[]>;
  timeSeries(
    filter: ImportedSalesFilter,
    groupBy: 'day' | 'week' | 'month',
    timeZone: string,
  ): Promise<ImportedTimeSeriesBucket[]>;
  byPaymentMethod(filter: ImportedSalesFilter): Promise<ImportedPaymentMethodRow[]>;
}
