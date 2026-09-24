import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  CostChangeTrigger,
  CostRefreshResult,
  CurrentBatchCost,
  ItemCostTracker,
} from '../../application/ports/item-cost-tracker';
import { InventoryLocationStatus, StockLayerStatus } from '../../domain/enums';
import { orderLayers } from '../../domain/services/consumption-planner';
import { recipeCostAmount } from '../../domain/services/recipe-costing';
import { unitCostMicroFromLine } from '../../domain/value-objects/money';

interface ItemCostRow {
  id: string;
  trackExpiry: boolean;
  consumptionLocationId: string | null;
  lastUnitCostMicro: bigint | null;
  currentUnitCostMicro: bigint | null;
}

/**
 * COST-FIFO-1 (Prisma). See ItemCostTracker. The "current batch" is the layer the
 * NEXT consumption would draw from: FIFO (oldest arrival) or FEFO (trackExpiry),
 * preferring the item's consumption location, mirroring the consumption planner.
 * Writes use compare-and-set (updateMany on the old value) so concurrent serves
 * never double-log the same switch.
 */
@Injectable()
export class PrismaItemCostTracker implements ItemCostTracker {
  private readonly logger = new Logger(PrismaItemCostTracker.name);

  constructor(private readonly prisma: PrismaService) {}

  async currentBatchCosts(
    restaurantId: string,
    branchId: string,
    itemIds: string[],
  ): Promise<Map<string, CurrentBatchCost>> {
    const ids = [...new Set(itemIds)];
    const result = new Map<string, CurrentBatchCost>();
    if (ids.length === 0) {
      return result;
    }
    const items: ItemCostRow[] = await this.prisma.inventoryItem.findMany({
      where: { id: { in: ids }, restaurantId, branchId },
      select: {
        id: true,
        trackExpiry: true,
        consumptionLocationId: true,
        lastUnitCostMicro: true,
        currentUnitCostMicro: true,
      },
    });
    return this.computeCosts(restaurantId, branchId, items);
  }

  private async computeCosts(
    restaurantId: string,
    branchId: string,
    items: ItemCostRow[],
  ): Promise<Map<string, CurrentBatchCost>> {
    const result = new Map<string, CurrentBatchCost>();
    if (items.length === 0) {
      return result;
    }
    const [defaultLocation, layers] = await Promise.all([
      this.prisma.inventoryLocation.findFirst({
        where: {
          restaurantId,
          branchId,
          isDefault: true,
          deletedAt: null,
          status: InventoryLocationStatus.ACTIVE,
        },
        select: { id: true },
      }),
      this.prisma.stockLayer.findMany({
        where: {
          restaurantId,
          branchId,
          itemId: { in: items.map((i) => i.id) },
          status: StockLayerStatus.OPEN,
          baseQtyRemaining: { gt: 0 },
        },
        select: {
          id: true,
          itemId: true,
          locationId: true,
          baseQtyReceived: true,
          baseQtyRemaining: true,
          lineTotalCostAmount: true,
          receivedAt: true,
          expiryDate: true,
          sourceReceiptLineId: true,
        },
      }),
    ]);

    type LayerRow = (typeof layers)[number];
    const byItem = new Map<string, LayerRow[]>();
    for (const l of layers) {
      const arr = byItem.get(l.itemId) ?? [];
      arr.push(l);
      byItem.set(l.itemId, arr);
    }

    const chosen = new Map<string, LayerRow>();
    for (const item of items) {
      const all = byItem.get(item.id) ?? [];
      if (all.length === 0) continue;
      const loc = item.consumptionLocationId ?? defaultLocation?.id ?? null;
      const atLoc = loc ? all.filter((l) => l.locationId === loc) : [];
      const pool = atLoc.length > 0 ? atLoc : all;
      const ordered = orderLayers(
        pool.map((l) => ({
          layerId: l.id,
          baseQtyReceived: l.baseQtyReceived,
          baseQtyRemaining: l.baseQtyRemaining,
          lineTotalCostAmount: l.lineTotalCostAmount,
          receivedAt: l.receivedAt,
          expiryDate: l.expiryDate,
        })),
        item.trackExpiry,
      );
      const first = pool.find((l) => l.id === ordered[0]?.layerId);
      if (first) chosen.set(item.id, first);
    }

    // Supplier of each chosen batch (layer -> receipt line -> receipt.supplierId).
    const lineIds = [...chosen.values()]
      .map((l) => l.sourceReceiptLineId)
      .filter((x): x is string => !!x);
    const supplierByLine = new Map<string, string | null>();
    if (lineIds.length > 0) {
      const lines = await this.prisma.goodsReceiptLine.findMany({
        where: { id: { in: lineIds } },
        select: { id: true, receipt: { select: { supplierId: true } } },
      });
      for (const l of lines) supplierByLine.set(l.id, l.receipt.supplierId);
    }

    for (const item of items) {
      const layer = chosen.get(item.id);
      if (layer) {
        result.set(item.id, {
          itemId: item.id,
          unitCostMicro: unitCostMicroFromLine(layer.lineTotalCostAmount, layer.baseQtyReceived),
          source: 'BATCH',
          layerId: layer.id,
          supplierId: layer.sourceReceiptLineId
            ? (supplierByLine.get(layer.sourceReceiptLineId) ?? null)
            : null,
          receivedAt: layer.receivedAt,
        });
        continue;
      }
      const fallback = item.currentUnitCostMicro ?? item.lastUnitCostMicro;
      result.set(item.id, {
        itemId: item.id,
        unitCostMicro: fallback,
        source: fallback === null ? 'NONE' : 'LAST_KNOWN',
        layerId: null,
        supplierId: null,
        receivedAt: null,
      });
    }
    return result;
  }

  async refresh(input: {
    restaurantId: string;
    branchId: string;
    itemIds: string[];
    trigger: CostChangeTrigger;
    occurredAt?: Date;
  }): Promise<CostRefreshResult> {
    const occurredAt = input.occurredAt ?? new Date();
    const ids = [...new Set(input.itemIds)];
    if (ids.length === 0) {
      return { changedItemIds: [], changedRecipeIds: [] };
    }
    const items: ItemCostRow[] = await this.prisma.inventoryItem.findMany({
      where: { id: { in: ids }, restaurantId: input.restaurantId, branchId: input.branchId },
      select: {
        id: true,
        trackExpiry: true,
        consumptionLocationId: true,
        lastUnitCostMicro: true,
        currentUnitCostMicro: true,
      },
    });
    const costs = await this.computeCosts(input.restaurantId, input.branchId, items);

    const changedItemIds: string[] = [];
    for (const item of items) {
      const cost = costs.get(item.id);
      const next = cost?.unitCostMicro ?? null;
      const prev = item.currentUnitCostMicro;
      if (next === null || next === prev) continue;

      // Compare-and-set: only the writer that flips the value logs the change.
      const updated = await this.prisma.inventoryItem.updateMany({
        where: { id: item.id, currentUnitCostMicro: prev },
        data: { currentUnitCostMicro: next },
      });
      if (updated.count !== 1) continue;
      changedItemIds.push(item.id);

      // A RECONCILE that only fills a never-set baseline is not a price change.
      if (prev === null && input.trigger === 'RECONCILE') continue;
      await this.prisma.inventoryItemCostChange.create({
        data: {
          restaurantId: input.restaurantId,
          branchId: input.branchId,
          itemId: item.id,
          oldUnitCostMicro: prev,
          newUnitCostMicro: next,
          layerId: cost?.layerId ?? null,
          supplierId: cost?.supplierId ?? null,
          trigger: input.trigger,
          occurredAt,
        },
      });
    }

    const changedRecipeIds =
      changedItemIds.length > 0
        ? await this.refreshRecipesUsing(
            input.restaurantId,
            input.branchId,
            changedItemIds,
            occurredAt,
          )
        : [];
    return { changedItemIds, changedRecipeIds };
  }

  /** Recompute the cost price of every live dish whose recipe uses a changed item. */
  private async refreshRecipesUsing(
    restaurantId: string,
    branchId: string,
    changedItemIds: string[],
    occurredAt: Date,
  ): Promise<string[]> {
    const recipeLines = await this.prisma.recipeLine.findMany({
      where: { branchId, itemId: { in: changedItemIds } },
      select: { recipeId: true },
    });
    const recipeIds = [...new Set(recipeLines.map((l) => l.recipeId))];
    if (recipeIds.length === 0) return [];
    return this.refreshRecipes(restaurantId, branchId, recipeIds, changedItemIds, occurredAt);
  }

  private async refreshRecipes(
    restaurantId: string,
    branchId: string,
    recipeIds: string[],
    changedItemIds: string[],
    occurredAt: Date,
  ): Promise<string[]> {
    const recipes = await this.prisma.recipe.findMany({
      where: { id: { in: recipeIds }, restaurantId, branchId, deletedAt: null },
      select: {
        id: true,
        menuItemId: true,
        costAmount: true,
        lines: { select: { itemId: true, baseQty: true } },
      },
    });
    if (recipes.length === 0) return [];

    const lineItemIds = [...new Set(recipes.flatMap((r) => r.lines.map((l) => l.itemId)))];
    const costs = await this.currentBatchCosts(restaurantId, branchId, lineItemIds);
    const micros = new Map<string, bigint>();
    for (const [id, c] of costs) {
      if (c.unitCostMicro !== null) micros.set(id, c.unitCostMicro);
    }

    const changed: string[] = [];
    const changedSet = new Set(changedItemIds);
    for (const r of recipes) {
      const next = recipeCostAmount(r.lines, micros);
      if (next === r.costAmount) continue;
      const updated = await this.prisma.recipe.updateMany({
        where: { id: r.id, costAmount: r.costAmount },
        data: { costAmount: next, costUpdatedAt: occurredAt },
      });
      if (updated.count !== 1) continue;
      changed.push(r.id);
      if (r.costAmount === null) continue; // first baseline, not a change
      const cause = r.lines.find((l) => changedSet.has(l.itemId))?.itemId ?? null;
      await this.prisma.recipeCostChange.create({
        data: {
          restaurantId,
          branchId,
          recipeId: r.id,
          menuItemId: r.menuItemId,
          oldCostAmount: r.costAmount,
          newCostAmount: next,
          causeItemId: cause,
          occurredAt,
        },
      });
    }
    return changed;
  }

  async refreshForRef(
    restaurantId: string,
    refType: string,
    refId: string,
    trigger: CostChangeTrigger,
  ): Promise<void> {
    const rows = await this.prisma.stockMovement.findMany({
      where: { restaurantId, refType, refId },
      select: { branchId: true, itemId: true },
      distinct: ['branchId', 'itemId'],
    });
    const byBranch = new Map<string, string[]>();
    for (const r of rows) {
      const arr = byBranch.get(r.branchId) ?? [];
      arr.push(r.itemId);
      byBranch.set(r.branchId, arr);
    }
    for (const [branchId, itemIds] of byBranch) {
      await this.refresh({ restaurantId, branchId, itemIds, trigger });
    }
  }

  async setRecipeBaseline(
    restaurantId: string,
    recipeId: string,
    costAmount: number,
  ): Promise<void> {
    await this.prisma.recipe.updateMany({
      where: { id: recipeId, restaurantId },
      data: { costAmount, costUpdatedAt: new Date() },
    });
  }

  async reconcileBranch(restaurantId: string, branchId: string): Promise<CostRefreshResult> {
    const items = await this.prisma.inventoryItem.findMany({
      where: { restaurantId, branchId, deletedAt: null },
      select: { id: true },
    });
    const result = await this.refresh({
      restaurantId,
      branchId,
      itemIds: items.map((i) => i.id),
      trigger: 'RECONCILE',
    });
    // Recipes whose stored cost drifted (or was never set) without an item change.
    const recipes = await this.prisma.recipe.findMany({
      where: { restaurantId, branchId, deletedAt: null },
      select: { id: true },
    });
    const extra = await this.refreshRecipes(
      restaurantId,
      branchId,
      recipes.map((r) => r.id),
      result.changedItemIds,
      new Date(),
    );
    const all = new Set([...result.changedRecipeIds, ...extra]);
    if (result.changedItemIds.length > 0 || all.size > 0) {
      this.logger.log(
        `Cost reconcile ${branchId}: ${result.changedItemIds.length} item(s), ${all.size} dish(es) updated.`,
      );
    }
    return { changedItemIds: result.changedItemIds, changedRecipeIds: [...all] };
  }
}
