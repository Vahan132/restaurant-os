import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  InventoryStockReader,
  StockFilter,
  StockRow,
} from '../../application/ports/inventory-stock.reader';
import { ItemKind, StockLayerStatus } from '../../domain/enums';
import { roundedDiv } from '../../domain/value-objects/money';

/**
 * Stock + valuation read model. On-hand is the SUM of the append-only movement
 * ledger (source of truth); valuation is the SUM over OPEN layers of the derived
 * remaining value (never a stored rounded unit cost). lowStock / expiringBefore
 * are evaluated on the computed figures, so they're applied before pagination.
 */
@Injectable()
export class PrismaInventoryStockReader implements InventoryStockReader {
  constructor(private readonly prisma: PrismaService) {}

  async stock(filter: StockFilter): Promise<StockRow[]> {
    const where: Prisma.InventoryItemWhereInput = {
      restaurantId: filter.restaurantId,
      branchId: filter.branchId,
      deletedAt: null,
      ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
      ...(filter.kind ? { kind: filter.kind } : {}),
      // INV-SEARCH-1: two-step search — local name OR an adopted item whose catalog name
      // matched (catalogItemId in the ids resolved by the use-case).
      ...(filter.search
        ? {
            OR: [
              { name: { contains: filter.search, mode: 'insensitive' } },
              ...(filter.matchedCatalogItemIds && filter.matchedCatalogItemIds.length > 0
                ? [{ catalogItemId: { in: filter.matchedCatalogItemIds } }]
                : []),
            ],
          }
        : {}),
    };

    // No DB `orderBy: name`: the use-case resolves effective names, sorts, then paginates.
    const items = await this.prisma.inventoryItem.findMany({ where });
    if (items.length === 0) {
      return [];
    }

    const itemIds = items.map((i) => i.id);

    const [onHandGroups, openLayers] = await Promise.all([
      this.prisma.stockMovement.groupBy({
        by: ['itemId'],
        where: {
          restaurantId: filter.restaurantId,
          branchId: filter.branchId,
          itemId: { in: itemIds },
        },
        _sum: { baseQty: true },
      }),
      this.prisma.stockLayer.findMany({
        where: {
          restaurantId: filter.restaurantId,
          branchId: filter.branchId,
          itemId: { in: itemIds },
          status: StockLayerStatus.OPEN,
          baseQtyRemaining: { gt: 0 },
        },
      }),
    ]);

    const onHandByItem = new Map<string, number>();
    for (const g of onHandGroups) {
      onHandByItem.set(g.itemId, g._sum.baseQty ?? 0);
    }

    const valuationByItem = new Map<string, number>();
    const earliestExpiryByItem = new Map<string, Date>();
    for (const l of openLayers) {
      const value = roundedDiv(l.lineTotalCostAmount * l.baseQtyRemaining, l.baseQtyReceived);
      valuationByItem.set(l.itemId, (valuationByItem.get(l.itemId) ?? 0) + value);
      if (l.expiryDate) {
        const current = earliestExpiryByItem.get(l.itemId);
        if (!current || l.expiryDate < current) {
          earliestExpiryByItem.set(l.itemId, l.expiryDate);
        }
      }
    }

    let rows: StockRow[] = items.map((i) => {
      const onHandBase = onHandByItem.get(i.id) ?? 0;
      const lowStock = i.lowStockThresholdBase !== null && onHandBase <= i.lowStockThresholdBase;
      return {
        itemId: i.id,
        name: i.name,
        catalogItemId: i.catalogItemId,
        sku: i.sku,
        categoryId: i.categoryId,
        kind: i.kind as ItemKind,
        baseUnit: i.baseUnit,
        onHandBase,
        valuationAmount: valuationByItem.get(i.id) ?? 0,
        lowStockThresholdBase: i.lowStockThresholdBase,
        lowStock,
        earliestExpiry: earliestExpiryByItem.get(i.id) ?? null,
      };
    });

    if (filter.lowStock) {
      rows = rows.filter((r) => r.lowStock);
    }
    if (filter.expiringBefore) {
      const before = filter.expiringBefore;
      rows = rows.filter((r) => r.earliestExpiry !== null && r.earliestExpiry < before);
    }

    // Full filtered set, unsorted + unpaginated — the use-case sorts by resolved name.
    return rows;
  }
}
