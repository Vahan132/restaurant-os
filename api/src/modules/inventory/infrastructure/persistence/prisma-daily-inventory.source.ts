import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  DailyInventorySource,
  DailyItemInfo,
  LedgerBucket,
  ScheduledBranch,
} from '../../application/ports/daily-inventory.source';

@Injectable()
export class PrismaDailyInventorySource implements DailyInventorySource {
  constructor(private readonly prisma: PrismaService) {}

  async ledgerBuckets(
    restaurantId: string,
    branchId: string,
    from: Date | null,
    to: Date,
  ): Promise<LedgerBucket[]> {
    const rows = await this.prisma.stockMovement.groupBy({
      by: ['itemId', 'type', 'refType'],
      where: {
        restaurantId,
        branchId,
        occurredAt: from ? { gte: from, lt: to } : { lt: to },
      },
      _sum: { baseQty: true, costAmount: true },
    });
    return rows.map((r) => ({
      itemId: r.itemId,
      type: r.type,
      refType: r.refType,
      qty: r._sum.baseQty ?? 0,
      cost: r._sum.costAmount ?? 0,
    }));
  }

  async itemsInfo(
    restaurantId: string,
    branchId: string,
    itemIds: string[],
  ): Promise<DailyItemInfo[]> {
    if (itemIds.length === 0) return [];
    const items = await this.prisma.inventoryItem.findMany({
      where: { id: { in: itemIds }, restaurantId, branchId },
      select: {
        id: true,
        name: true,
        catalogItemId: true,
        baseUnit: true,
        alternateUnits: true,
        categoryId: true,
        currentUnitCostMicro: true,
      },
    });
    const categoryIds = [
      ...new Set(items.map((i) => i.categoryId).filter((x): x is string => !!x)),
    ];
    const categories =
      categoryIds.length > 0
        ? await this.prisma.inventoryCategory.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true },
          })
        : [];
    const catName = new Map(categories.map((c) => [c.id, c.name]));
    return items.map((i) => ({
      id: i.id,
      name: i.name,
      catalogItemId: i.catalogItemId,
      baseUnit: i.baseUnit,
      alternateUnits: Array.isArray(i.alternateUnits)
        ? (i.alternateUnits as unknown as Array<{ name: string; factor: number }>)
        : [],
      categoryId: i.categoryId,
      categoryName: i.categoryId ? (catName.get(i.categoryId) ?? null) : null,
      currentUnitCostMicro: i.currentUnitCostMicro,
    }));
  }

  async menuItemNames(restaurantId: string, menuItemIds: string[]): Promise<Map<string, string>> {
    if (menuItemIds.length === 0) return new Map();
    const rows = await this.prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, restaurantId },
      select: { id: true, name: true },
    });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  async restaurantTimezone(restaurantId: string): Promise<string> {
    const r = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { timezone: true },
    });
    return r?.timezone || 'UTC';
  }

  async findSnapshot(branchId: string, businessDate: string): Promise<unknown | null> {
    const row = await this.prisma.inventoryDailyReport.findUnique({
      where: { branchId_businessDate: { branchId, businessDate } },
      select: { payload: true },
    });
    return row ? row.payload : null;
  }

  async saveSnapshot(input: {
    restaurantId: string;
    branchId: string;
    businessDate: string;
    timezone: string;
    payload: unknown;
    generatedAt: Date;
  }): Promise<void> {
    const data = {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      businessDate: input.businessDate,
      timezone: input.timezone,
      payload: input.payload as Prisma.InputJsonValue,
      generatedAt: input.generatedAt,
    };
    await this.prisma.inventoryDailyReport.upsert({
      where: {
        branchId_businessDate: { branchId: input.branchId, businessDate: input.businessDate },
      },
      create: data,
      update: data,
    });
  }

  async scheduledBranches(): Promise<ScheduledBranch[]> {
    const rows = await this.prisma.branch.findMany({
      where: { status: 'ACTIVE', deletedAt: null, restaurant: { status: 'ACTIVE' } },
      select: { id: true, restaurantId: true, restaurant: { select: { timezone: true } } },
    });
    return rows.map((b) => ({
      restaurantId: b.restaurantId,
      branchId: b.id,
      timezone: b.restaurant.timezone || 'UTC',
    }));
  }
}
