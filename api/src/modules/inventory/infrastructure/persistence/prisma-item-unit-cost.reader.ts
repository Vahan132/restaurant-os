import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { ItemUnitCostReader } from '../../application/ports/item-unit-cost.reader';
import { StockLayerStatus } from '../../domain/enums';
import { roundedDiv } from '../../domain/value-objects/money';

const MICRO = 1_000_000;

/**
 * Per-item unit-cost estimate at MICRO precision (§3): item.lastUnitCostMicro if
 * set, else the weighted cost of the item's current OPEN layers
 * (Σ remaining cost / Σ remaining qty × 1e6), else 0. Estimate only.
 */
@Injectable()
export class PrismaItemUnitCostReader implements ItemUnitCostReader {
  constructor(private readonly prisma: PrismaService) {}

  async unitCostMicroByItem(
    restaurantId: string,
    branchId: string,
    itemIds: string[],
  ): Promise<Map<string, bigint>> {
    const result = new Map<string, bigint>();
    if (itemIds.length === 0) {
      return result;
    }

    const items = await this.prisma.inventoryItem.findMany({
      where: { id: { in: itemIds }, restaurantId, branchId },
      select: { id: true, lastUnitCostMicro: true },
    });

    const needWeighted: string[] = [];
    for (const it of items) {
      if (it.lastUnitCostMicro !== null) {
        result.set(it.id, it.lastUnitCostMicro);
      } else {
        needWeighted.push(it.id);
      }
    }

    if (needWeighted.length > 0) {
      const layers = await this.prisma.stockLayer.findMany({
        where: {
          restaurantId,
          branchId,
          itemId: { in: needWeighted },
          status: StockLayerStatus.OPEN,
          baseQtyRemaining: { gt: 0 },
        },
        select: {
          itemId: true,
          baseQtyReceived: true,
          baseQtyRemaining: true,
          lineTotalCostAmount: true,
        },
      });

      const agg = new Map<string, { cost: number; qty: number }>();
      for (const l of layers) {
        const remainingCost = roundedDiv(
          l.lineTotalCostAmount * l.baseQtyRemaining,
          l.baseQtyReceived,
        );
        const cur = agg.get(l.itemId) ?? { cost: 0, qty: 0 };
        cur.cost += remainingCost;
        cur.qty += l.baseQtyRemaining;
        agg.set(l.itemId, cur);
      }

      for (const id of needWeighted) {
        const a = agg.get(id);
        const micro = a && a.qty > 0 ? BigInt(roundedDiv(a.cost * MICRO, a.qty)) : 0n;
        result.set(id, micro);
      }
    }

    return result;
  }
}
