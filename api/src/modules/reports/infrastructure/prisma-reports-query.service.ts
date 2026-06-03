import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { OrderStatus } from '../../orders/domain/enums';
import { bucketKey } from '../application/report-time.util';
import {
  CancellationsData,
  DashboardData,
  DiscountsData,
  ItemRow,
  PaymentMethodRow,
  ReportsQuery,
  SalesSummaryData,
  TableRow,
  TimeSeriesBucket,
  WaiterRow,
} from '../application/ports/reports-query.port';

const NON_TERMINAL: OrderStatus[] = [
  OrderStatus.DRAFT,
  OrderStatus.SENT_TO_KITCHEN,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.SERVED,
];

/**
 * Read-model query service. Uses PrismaService DIRECTLY (allowed for the read
 * side). Revenue basis = CLOSED orders bucketed by closedAt; integer minor units;
 * NO tax anywhere. Aggregation is in TypeScript for portability; the queries are
 * intentionally simple so they can be swapped for SQL aggregates / daily rollups.
 */
@Injectable()
export class PrismaReportsQueryService implements ReportsQuery {
  constructor(private readonly prisma: PrismaService) {}

  async timezone(restaurantId: string): Promise<string> {
    const r = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId },
      select: { timezone: true },
    });
    return r?.timezone ?? 'UTC';
  }

  private closedOrders(restaurantId: string, from: Date, to: Date) {
    return this.prisma.order.findMany({
      where: { restaurantId, status: 'CLOSED', closedAt: { gte: from, lt: to } },
    });
  }

  private async tableNames(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await this.prisma.restaurantTable.findMany({ where: { id: { in: unique } } });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  private async userNames(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await this.prisma.user.findMany({ where: { id: { in: unique } } });
    return new Map(rows.map((r) => [r.id, r.fullName]));
  }

  private async itemsForOrders(orderIds: string[], onlyActive: boolean) {
    if (orderIds.length === 0) return [];
    const items = await this.prisma.orderItem.findMany({ where: { orderId: { in: orderIds } } });
    return onlyActive ? items.filter((i) => i.status !== 'CANCELLED') : items;
  }

  async dashboard(restaurantId: string, dayStart: Date, dayEnd: Date): Promise<DashboardData> {
    const closedToday = await this.closedOrders(restaurantId, dayStart, dayEnd);
    const todaysRevenueAmount = closedToday.reduce((s, o) => s + o.totalAmount, 0);

    const ordersToday = await this.prisma.order.count({
      where: { restaurantId, createdAt: { gte: dayStart, lt: dayEnd } },
    });
    const openOrders = await this.prisma.order.count({
      where: { restaurantId, status: { in: NON_TERMINAL } },
    });
    const occupiedTables = await this.prisma.restaurantTable.count({
      where: { restaurantId, status: 'OCCUPIED', deletedAt: null },
    });

    // top items today (non-cancelled items of orders closed today)
    const items = await this.itemsForOrders(
      closedToday.map((o) => o.id),
      true,
    );
    const byItem = new Map<string, { name: string; quantity: number }>();
    for (const it of items) {
      const cur = byItem.get(it.menuItemId) ?? { name: it.nameSnapshot, quantity: 0 };
      cur.quantity += it.quantity;
      byItem.set(it.menuItemId, cur);
    }
    const topItemsToday = [...byItem.entries()]
      .map(([menuItemId, v]) => ({ menuItemId, name: v.name, quantity: v.quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const recent = await this.prisma.order.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const tnames = await this.tableNames(
      recent.map((o) => o.tableId).filter((t): t is string => !!t),
    );
    const recentOrders = recent.map((o) => ({
      orderId: o.id,
      orderNumber: o.orderNumber,
      tableName: o.tableId ? (tnames.get(o.tableId) ?? null) : null,
      totalAmount: o.totalAmount,
      status: o.status,
    }));

    return {
      todaysRevenueAmount,
      ordersToday,
      openOrders,
      occupiedTables,
      topItemsToday,
      recentOrders,
    };
  }

  async salesSummary(restaurantId: string, from: Date, to: Date): Promise<SalesSummaryData> {
    const closed = await this.closedOrders(restaurantId, from, to);
    const totalRevenueAmount = closed.reduce((s, o) => s + o.totalAmount, 0);
    const totalDiscountAmount = closed.reduce((s, o) => s + o.discountAmount, 0);
    const closedOrderCount = closed.length;
    const averageOrderValueAmount =
      closedOrderCount > 0 ? Math.floor(totalRevenueAmount / closedOrderCount) : 0;

    const cancelled = await this.prisma.order.findMany({
      where: { restaurantId, status: 'CANCELLED', createdAt: { gte: from, lt: to } },
    });
    return {
      totalRevenueAmount,
      closedOrderCount,
      averageOrderValueAmount,
      totalDiscountAmount,
      cancelledOrderCount: cancelled.length,
      cancelledOrderValueAmount: cancelled.reduce((s, o) => s + o.totalAmount, 0),
    };
  }

  async salesTimeSeries(
    restaurantId: string,
    from: Date,
    to: Date,
    groupBy: 'day' | 'week' | 'month',
    timeZone: string,
  ): Promise<TimeSeriesBucket[]> {
    const closed = await this.closedOrders(restaurantId, from, to);
    const buckets = new Map<string, { revenueAmount: number; orderCount: number }>();
    for (const o of closed) {
      const key = bucketKey(o.closedAt as Date, timeZone, groupBy);
      const cur = buckets.get(key) ?? { revenueAmount: 0, orderCount: 0 };
      cur.revenueAmount += o.totalAmount;
      cur.orderCount += 1;
      buckets.set(key, cur);
    }
    return [...buckets.entries()]
      .map(([bucket, v]) => ({ bucket, ...v }))
      .sort((a, b) => a.bucket.localeCompare(b.bucket));
  }

  async salesByPaymentMethod(
    restaurantId: string,
    from: Date,
    to: Date,
  ): Promise<PaymentMethodRow[]> {
    const closed = await this.closedOrders(restaurantId, from, to);
    const orderIds = closed.map((o) => o.id);
    if (orderIds.length === 0) return [];
    const payments = await this.prisma.payment.findMany({
      where: { orderId: { in: orderIds }, state: 'ACTIVE' },
    });
    const byMethod = new Map<string, number>();
    for (const p of payments) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount);
    return [...byMethod.entries()]
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount);
  }

  async salesByWaiter(restaurantId: string, from: Date, to: Date): Promise<WaiterRow[]> {
    const closed = await this.closedOrders(restaurantId, from, to);
    const agg = new Map<string, { revenueAmount: number; orderCount: number }>();
    for (const o of closed) {
      const cur = agg.get(o.waiterId) ?? { revenueAmount: 0, orderCount: 0 };
      cur.revenueAmount += o.totalAmount;
      cur.orderCount += 1;
      agg.set(o.waiterId, cur);
    }
    const names = await this.userNames([...agg.keys()]);
    return [...agg.entries()]
      .map(([waiterId, v]) => ({ waiterId, waiterName: names.get(waiterId) ?? null, ...v }))
      .sort((a, b) => b.revenueAmount - a.revenueAmount);
  }

  async salesByTable(restaurantId: string, from: Date, to: Date): Promise<TableRow[]> {
    const closed = await this.closedOrders(restaurantId, from, to);
    const agg = new Map<string, { revenueAmount: number; orderCount: number }>();
    for (const o of closed) {
      const key = o.tableId ?? '__none__';
      const cur = agg.get(key) ?? { revenueAmount: 0, orderCount: 0 };
      cur.revenueAmount += o.totalAmount;
      cur.orderCount += 1;
      agg.set(key, cur);
    }
    const names = await this.tableNames([...agg.keys()].filter((k) => k !== '__none__'));
    return [...agg.entries()]
      .map(([key, v]) => ({
        tableId: key === '__none__' ? null : key,
        tableName: key === '__none__' ? null : (names.get(key) ?? null),
        ...v,
      }))
      .sort((a, b) => b.revenueAmount - a.revenueAmount);
  }

  async salesByItem(restaurantId: string, from: Date, to: Date): Promise<ItemRow[]> {
    const closed = await this.closedOrders(restaurantId, from, to);
    const items = await this.itemsForOrders(
      closed.map((o) => o.id),
      true,
    );
    const agg = new Map<string, { name: string; quantity: number; revenueAmount: number }>();
    for (const it of items) {
      const cur = agg.get(it.menuItemId) ?? {
        name: it.nameSnapshot,
        quantity: 0,
        revenueAmount: 0,
      };
      cur.quantity += it.quantity;
      cur.revenueAmount += it.lineTotalAmount;
      agg.set(it.menuItemId, cur);
    }
    return [...agg.entries()]
      .map(([menuItemId, v]) => ({ menuItemId, ...v }))
      .sort((a, b) => b.revenueAmount - a.revenueAmount);
  }

  async discounts(restaurantId: string, from: Date, to: Date): Promise<DiscountsData> {
    const closed = await this.closedOrders(restaurantId, from, to);
    const withDiscount = closed.filter((o) => o.discountAmount > 0);
    return {
      totalDiscountAmount: withDiscount.reduce((s, o) => s + o.discountAmount, 0),
      orders: withDiscount
        .map((o) => ({
          orderId: o.id,
          orderNumber: o.orderNumber,
          discountAmount: o.discountAmount,
        }))
        .sort((a, b) => b.discountAmount - a.discountAmount),
    };
  }

  async cancellations(restaurantId: string, from: Date, to: Date): Promise<CancellationsData> {
    const cancelledOrders = await this.prisma.order.findMany({
      where: { restaurantId, status: 'CANCELLED', createdAt: { gte: from, lt: to } },
      orderBy: { createdAt: 'desc' },
    });
    // cancelled items across orders created in the window (item-level cancels)
    const orders = await this.prisma.order.findMany({
      where: { restaurantId, createdAt: { gte: from, lt: to } },
    });
    const cancelledItemsRaw = await this.itemsForOrders(
      orders.map((o) => o.id),
      false,
    );
    const cancelledItems = cancelledItemsRaw
      .filter((i) => i.status === 'CANCELLED')
      .map((i) => ({
        orderItemId: i.id,
        orderId: i.orderId,
        name: i.nameSnapshot,
        quantity: i.quantity,
        lineTotalAmount: i.lineTotalAmount,
        reason: i.cancelledReason,
      }));
    return {
      cancelledOrders: cancelledOrders.map((o) => ({
        orderId: o.id,
        orderNumber: o.orderNumber,
        totalAmount: o.totalAmount,
        reason: o.cancelledReason,
      })),
      cancelledItems,
    };
  }
}
