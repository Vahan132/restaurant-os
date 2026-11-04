import { ApiProperty } from '@nestjs/swagger';

export class TopItemResponse {
  @ApiProperty() menuItemId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() quantity!: number;
}
export class RecentOrderResponse {
  @ApiProperty() orderId!: string;
  @ApiProperty() orderNumber!: number;
  @ApiProperty({ nullable: true, type: String }) tableName!: string | null;
  @ApiProperty() totalAmount!: number;
  @ApiProperty() status!: string;
}
export class DashboardResponse {
  @ApiProperty() todaysRevenueAmount!: number;
  @ApiProperty() ordersToday!: number;
  @ApiProperty() openOrders!: number;
  @ApiProperty() occupiedTables!: number;
  @ApiProperty({ type: [TopItemResponse] }) topItemsToday!: TopItemResponse[];
  @ApiProperty({ type: [RecentOrderResponse] }) recentOrders!: RecentOrderResponse[];
}
export class SalesSummaryResponse {
  @ApiProperty() totalRevenueAmount!: number;
  @ApiProperty() closedOrderCount!: number;
  @ApiProperty() averageOrderValueAmount!: number;
  @ApiProperty() totalDiscountAmount!: number;
  @ApiProperty() cancelledOrderCount!: number;
  @ApiProperty() cancelledOrderValueAmount!: number;
}
export class TimeSeriesBucketResponse {
  @ApiProperty() bucket!: string;
  @ApiProperty() revenueAmount!: number;
  @ApiProperty() orderCount!: number;
}
export class PaymentMethodResponse {
  @ApiProperty() method!: string;
  @ApiProperty() amount!: number;
  @ApiProperty({ description: 'Number of ACTIVE payments recorded with this method.' })
  paymentCount!: number;
}
export class BranchPaymentMethodsResponse {
  @ApiProperty({ description: 'Business day reported on (YYYY-MM-DD, restaurant tz).' })
  date!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty({ type: [PaymentMethodResponse] }) rows!: PaymentMethodResponse[];
  @ApiProperty() totalAmount!: number;
  @ApiProperty() paymentCount!: number;
  @ApiProperty({ description: 'Closed orders in the day that carry at least one payment.' })
  orderCount!: number;
}
export class WaiterRowResponse {
  @ApiProperty() waiterId!: string;
  @ApiProperty({ nullable: true, type: String }) waiterName!: string | null;
  @ApiProperty() revenueAmount!: number;
  @ApiProperty() orderCount!: number;
}
export class TableRowResponse {
  @ApiProperty({ nullable: true, type: String }) tableId!: string | null;
  @ApiProperty({ nullable: true, type: String }) tableName!: string | null;
  @ApiProperty() revenueAmount!: number;
  @ApiProperty() orderCount!: number;
}
export class ItemRowResponse {
  @ApiProperty() menuItemId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) categoryId!: string | null;
  @ApiProperty({ type: String, nullable: true }) categoryName!: string | null;
  @ApiProperty() quantity!: number;
  @ApiProperty() revenueAmount!: number;
  @ApiProperty({ description: 'Cost price of the sold quantity (minor units).' })
  costAmount!: number;
  @ApiProperty({ description: 'revenue - cost (minor units).' }) grossProfitAmount!: number;
  @ApiProperty({ description: 'Part of the cost is a recipe estimate (no stock movement).' })
  costEstimated!: boolean;
}
export class DiscountOrderResponse {
  @ApiProperty() orderId!: string;
  @ApiProperty() orderNumber!: number;
  @ApiProperty() discountAmount!: number;
}
export class DiscountsResponse {
  @ApiProperty() totalDiscountAmount!: number;
  @ApiProperty({ type: [DiscountOrderResponse] }) orders!: DiscountOrderResponse[];
}
export class CancelledOrderResponse {
  @ApiProperty() orderId!: string;
  @ApiProperty() orderNumber!: number;
  @ApiProperty() totalAmount!: number;
  @ApiProperty({ nullable: true, type: String }) reason!: string | null;
}
export class CancelledItemResponse {
  @ApiProperty() orderItemId!: string;
  @ApiProperty() orderId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() lineTotalAmount!: number;
  @ApiProperty({ nullable: true, type: String }) reason!: string | null;
}
export class CancellationsResponse {
  @ApiProperty({ type: [CancelledOrderResponse] }) cancelledOrders!: CancelledOrderResponse[];
  @ApiProperty({ type: [CancelledItemResponse] }) cancelledItems!: CancelledItemResponse[];
}

/** PROFIT-XLSX-1: period P&L totals (minor units). */
export class ProfitTotalsResponse {
  @ApiProperty({ description: 'Sum of sold lines before order discounts.' }) salesAmount!: number;
  @ApiProperty() discountAmount!: number;
  @ApiProperty({ description: 'Closed orders total.' }) revenueAmount!: number;
  @ApiProperty({ description: 'Cost price of sold items (FIFO).' }) costAmount!: number;
  @ApiProperty() grossProfitAmount!: number;
  @ApiProperty() writeOffAmount!: number;
  @ApiProperty() expenseAmount!: number;
  @ApiProperty() netProfitAmount!: number;
}
