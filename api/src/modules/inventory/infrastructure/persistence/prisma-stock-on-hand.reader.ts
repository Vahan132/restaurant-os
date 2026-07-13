import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { OnHandRow, StockOnHandReader } from '../../application/ports/stock-on-hand.reader';

type RawOnHand = {
  itemId: string;
  locationId: string;
  quantity: number;
  lowStockThresholdBase: number | null;
};

/**
 * Read model over the materialized StockOnHand projection (6A). Inventory tables
 * carry plain id columns (no Prisma relations), so item + location names are
 * resolved with companion lookups. Effective threshold = per-location override
 * else the item's lowStockThresholdBase.
 */
@Injectable()
export class PrismaStockOnHandReader implements StockOnHandReader {
  constructor(private readonly prisma: PrismaService) {}

  async byLocation(
    restaurantId: string,
    branchId: string,
    locationId: string,
  ): Promise<OnHandRow[]> {
    const rows = await this.prisma.stockOnHand.findMany({
      where: { restaurantId, branchId, locationId },
    });
    return this.decorate(rows);
  }

  async byItem(restaurantId: string, branchId: string, itemId: string): Promise<OnHandRow[]> {
    const rows = await this.prisma.stockOnHand.findMany({
      where: { restaurantId, branchId, itemId },
    });
    return this.decorate(rows);
  }

  async quantityAt(
    restaurantId: string,
    branchId: string,
    itemId: string,
    locationId: string,
  ): Promise<number> {
    const row = await this.prisma.stockOnHand.findFirst({
      where: { restaurantId, branchId, itemId, locationId },
      select: { quantity: true },
    });
    return row?.quantity ?? 0;
  }

  async locationHasStock(
    restaurantId: string,
    branchId: string,
    locationId: string,
  ): Promise<boolean> {
    const count = await this.prisma.stockOnHand.count({
      where: { restaurantId, branchId, locationId, quantity: { not: 0 } },
    });
    return count > 0;
  }

  private async decorate(rows: RawOnHand[]): Promise<OnHandRow[]> {
    if (rows.length === 0) {
      return [];
    }
    const itemIds = [...new Set(rows.map((r) => r.itemId))];
    const locationIds = [...new Set(rows.map((r) => r.locationId))];
    const [items, locations] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where: { id: { in: itemIds } },
        select: {
          id: true,
          name: true,
          catalogItemId: true,
          baseUnit: true,
          lowStockThresholdBase: true,
        },
      }),
      this.prisma.inventoryLocation.findMany({
        where: { id: { in: locationIds } },
        select: { id: true, name: true },
      }),
    ]);
    const itemById = new Map(items.map((i) => [i.id, i]));
    const locationById = new Map(locations.map((l) => [l.id, l]));

    return rows.map((r) => {
      const item = itemById.get(r.itemId);
      const eff = r.lowStockThresholdBase ?? item?.lowStockThresholdBase ?? null;
      return {
        itemId: r.itemId,
        // PLATCAT-ADOPT-1B: local name (null for adopted); catalogName filled in the use-case.
        itemName: item?.name ?? null,
        catalogItemId: item?.catalogItemId ?? null,
        baseUnit: item?.baseUnit ?? '',
        locationId: r.locationId,
        locationName: locationById.get(r.locationId)?.name ?? '',
        quantity: r.quantity,
        lowStockThresholdBase: eff,
        lowStock: eff !== null && r.quantity <= eff,
      };
    });
  }
}
