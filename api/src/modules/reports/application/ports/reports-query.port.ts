export const REPORTS_QUERY = Symbol('ReportsQuery');

export interface TopItem {
  menuItemId: string;
  name: string;
  quantity: number;
}
export interface RecentOrder {
  orderId: string;
  orderNumber: number;
  tableName: string | null;
  totalAmount: number;
  status: string;
}
export interface DashboardData {
  todaysRevenueAmount: number;
  ordersToday: number;
  openOrders: number;
  occupiedTables: number;
  topItemsToday: TopItem[];
  recentOrders: RecentOrder[];
}
export interface SalesSummaryData {
  totalRevenueAmount: number;
  closedOrderCount: number;
  averageOrderValueAmount: number;
  totalDiscountAmount: number;
  cancelledOrderCount: number;
  cancelledOrderValueAmount: number;
}
export interface TimeSeriesBucket {
  bucket: string;
  revenueAmount: number;
  orderCount: number;
}
export interface PaymentMethodRow {
  method: string;
  amount: number;
  /** Number of ACTIVE payments recorded with this method. */
  paymentCount: number;
}

/**
 * One branch's payment-method breakdown for a single business day — the cashier
 * shift report. Same basis as the restaurant-wide report (ACTIVE payments on
 * orders CLOSED in the window), narrowed to one branch.
 */
export interface BranchPaymentMethodsData {
  rows: PaymentMethodRow[];
  totalAmount: number;
  paymentCount: number;
  /** Closed orders at this branch in the window that carry at least one payment. */
  orderCount: number;
}
export interface WaiterRow {
  waiterId: string;
  waiterName: string | null;
  revenueAmount: number;
  orderCount: number;
}
export interface TableRow {
  tableId: string | null;
  tableName: string | null;
  revenueAmount: number;
  orderCount: number;
}
export interface ItemRow {
  menuItemId: string;
  name: string;
  quantity: number;
  revenueAmount: number;
}
export interface DiscountsData {
  totalDiscountAmount: number;
  orders: { orderId: string; orderNumber: number; discountAmount: number }[];
}
export interface CancellationsData {
  cancelledOrders: {
    orderId: string;
    orderNumber: number;
    totalAmount: number;
    reason: string | null;
  }[];
  cancelledItems: {
    orderItemId: string;
    orderId: string;
    name: string;
    quantity: number;
    lineTotalAmount: number;
    reason: string | null;
  }[];
}

/**
 * Read-side query port for reports. Implemented in infrastructure using
 * PrismaService directly (allowed for the read model — no aggregate/repository).
 * Computed on-the-fly from CLOSED orders/payments; written so the JS aggregation
 * can later be swapped for SQL date_trunc / precomputed daily aggregates.
 */
export interface ReportsQuery {
  /** Restaurant IANA timezone (for day boundaries + buckets). */
  timezone(restaurantId: string): Promise<string>;
  dashboard(restaurantId: string, dayStart: Date, dayEnd: Date): Promise<DashboardData>;
  salesSummary(restaurantId: string, from: Date, to: Date): Promise<SalesSummaryData>;
  salesTimeSeries(
    restaurantId: string,
    from: Date,
    to: Date,
    groupBy: 'day' | 'week' | 'month',
    timeZone: string,
  ): Promise<TimeSeriesBucket[]>;
  salesByPaymentMethod(restaurantId: string, from: Date, to: Date): Promise<PaymentMethodRow[]>;
  branchPaymentMethods(
    restaurantId: string,
    branchId: string,
    from: Date,
    to: Date,
  ): Promise<BranchPaymentMethodsData>;
  salesByWaiter(restaurantId: string, from: Date, to: Date): Promise<WaiterRow[]>;
  salesByTable(restaurantId: string, from: Date, to: Date): Promise<TableRow[]>;
  salesByItem(restaurantId: string, from: Date, to: Date): Promise<ItemRow[]>;
  discounts(restaurantId: string, from: Date, to: Date): Promise<DiscountsData>;
  cancellations(restaurantId: string, from: Date, to: Date): Promise<CancellationsData>;
}
