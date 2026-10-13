import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { bucketKey } from '../../application/imported-report-time.util';
import {
  ImportedItemRow,
  ImportedPaymentMethodRow,
  ImportedSalesAnalyticsReader,
  ImportedSalesFilter,
  ImportedSalesSummary,
  ImportedTimeSeriesBucket,
} from '../../application/ports/imported-sales-analytics.reader';
import { BranchScope } from '../../domain/repositories/sales-import.repository';

/**
 * Read-model service for IMPORTED-SALES analytics. Queries EXCLUSIVELY the
 * `imported_sales` table — it can never read orders/payments, so imported data
 * is structurally absent from every fiscal report. Aggregation is in TypeScript
 * for portability (mirrors the reports module). Money stays in minor units.
 */
@Injectable()
export class PrismaImportedSalesAnalyticsReader implements ImportedSalesAnalyticsReader {
  constructor(private readonly prisma: PrismaService) {}

  async timezone(restaurantId: string): Promise<string> {
    const r = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId },
      select: { timezone: true },
    });
    return r?.timezone ?? 'UTC';
  }

  private where(filter: ImportedSalesFilter): Prisma.ImportedSaleWhereInput {
    const branch = this.branchWhere(filter.scope);
    return {
      restaurantId: filter.restaurantId,
      occurredAt: { gte: filter.from, lt: filter.to },
      ...branch,
    };
  }

  private branchWhere(scope: BranchScope): Prisma.ImportedSaleWhereInput {
    return scope.all ? {} : { branchId: { in: scope.branchIds } };
  }

  private rows(filter: ImportedSalesFilter) {
    return this.prisma.importedSale.findMany({ where: this.where(filter) });
  }

  async summary(filter: ImportedSalesFilter): Promise<ImportedSalesSummary> {
    const sales = await this.rows(filter);
    return {
      totalRevenueAmount: sales.reduce((s, x) => s + x.lineTotalAmount, 0),
      saleCount: sales.length,
      totalQuantity: sales.reduce((s, x) => s + x.quantity, 0),
    };
  }

  async byItem(filter: ImportedSalesFilter): Promise<ImportedItemRow[]> {
    const sales = await this.rows(filter);
    const agg = new Map<string, ImportedItemRow>();
    for (const s of sales) {
      const key = s.itemId ?? `desc:${s.itemDescription.toLowerCase()}`;
      const cur =
        agg.get(key) ??
        ({
          itemId: s.itemId,
          itemDescription: s.itemDescription,
          quantity: 0,
          revenueAmount: 0,
        } as ImportedItemRow);
      cur.quantity += s.quantity;
      cur.revenueAmount += s.lineTotalAmount;
      agg.set(key, cur);
    }
    return [...agg.values()].sort((a, b) => b.revenueAmount - a.revenueAmount);
  }

  async timeSeries(
    filter: ImportedSalesFilter,
    groupBy: 'day' | 'week' | 'month',
    timeZone: string,
  ): Promise<ImportedTimeSeriesBucket[]> {
    const sales = await this.rows(filter);
    const buckets = new Map<string, { revenueAmount: number; saleCount: number }>();
    for (const s of sales) {
      const key = bucketKey(s.occurredAt, timeZone, groupBy);
      const cur = buckets.get(key) ?? { revenueAmount: 0, saleCount: 0 };
      cur.revenueAmount += s.lineTotalAmount;
      cur.saleCount += 1;
      buckets.set(key, cur);
    }
    return [...buckets.entries()]
      .map(([bucket, v]) => ({ bucket, ...v }))
      .sort((a, b) => a.bucket.localeCompare(b.bucket));
  }

  async byPaymentMethod(filter: ImportedSalesFilter): Promise<ImportedPaymentMethodRow[]> {
    const sales = await this.rows(filter);
    const byMethod = new Map<string, number>();
    for (const s of sales) {
      const method = s.paymentMethod ?? 'UNKNOWN';
      byMethod.set(method, (byMethod.get(method) ?? 0) + s.lineTotalAmount);
    }
    return [...byMethod.entries()]
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount);
  }
}
