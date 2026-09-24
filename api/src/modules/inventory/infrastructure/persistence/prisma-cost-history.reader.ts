import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  CostHistoryReader,
  ItemCostChangeView,
  RecipeCostChangeView,
  RecipeCostingSource,
} from '../../application/ports/cost-history.reader';

type RecipeChangeRow = {
  id: string;
  recipeId: string;
  menuItemId: string;
  oldCostAmount: number | null;
  newCostAmount: number;
  causeItemId: string | null;
  occurredAt: Date;
};

const toRecipeView = (r: RecipeChangeRow): RecipeCostChangeView => ({
  id: r.id,
  recipeId: r.recipeId,
  menuItemId: r.menuItemId,
  oldCostAmount: r.oldCostAmount,
  newCostAmount: r.newCostAmount,
  causeItemId: r.causeItemId,
  occurredAt: r.occurredAt,
});

@Injectable()
export class PrismaCostHistoryReader implements CostHistoryReader {
  constructor(private readonly prisma: PrismaService) {}

  async recipeChanges(
    restaurantId: string,
    branchId: string,
    recipeId: string,
    limit: number,
  ): Promise<RecipeCostChangeView[]> {
    const rows = await this.prisma.recipeCostChange.findMany({
      where: { restaurantId, branchId, recipeId },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });
    return rows.map(toRecipeView);
  }

  async latestRecipeChanges(
    restaurantId: string,
    branchId: string,
    recipeIds: string[],
  ): Promise<Map<string, RecipeCostChangeView>> {
    const result = new Map<string, RecipeCostChangeView>();
    if (recipeIds.length === 0) return result;
    const rows = await this.prisma.recipeCostChange.findMany({
      where: { restaurantId, branchId, recipeId: { in: recipeIds } },
      orderBy: { occurredAt: 'desc' },
      distinct: ['recipeId'],
    });
    for (const r of rows) result.set(r.recipeId, toRecipeView(r));
    return result;
  }

  async itemChangesBetween(
    restaurantId: string,
    branchId: string,
    from: Date,
    to: Date,
  ): Promise<ItemCostChangeView[]> {
    const rows = await this.prisma.inventoryItemCostChange.findMany({
      where: { restaurantId, branchId, occurredAt: { gte: from, lt: to } },
      orderBy: { occurredAt: 'asc' },
    });
    const supplierIds = [...new Set(rows.map((r) => r.supplierId).filter((x): x is string => !!x))];
    const suppliers =
      supplierIds.length > 0
        ? await this.prisma.supplier.findMany({
            where: { id: { in: supplierIds } },
            select: { id: true, name: true },
          })
        : [];
    const nameById = new Map(suppliers.map((s) => [s.id, s.name]));
    return rows.map((r) => ({
      id: r.id,
      itemId: r.itemId,
      oldUnitCostMicro: r.oldUnitCostMicro,
      newUnitCostMicro: r.newUnitCostMicro,
      layerId: r.layerId,
      supplierId: r.supplierId,
      supplierName: r.supplierId ? (nameById.get(r.supplierId) ?? null) : null,
      trigger: r.trigger,
      occurredAt: r.occurredAt,
    }));
  }

  async recipeChangesBetween(
    restaurantId: string,
    branchId: string,
    from: Date,
    to: Date,
  ): Promise<RecipeCostChangeView[]> {
    const rows = await this.prisma.recipeCostChange.findMany({
      where: { restaurantId, branchId, occurredAt: { gte: from, lt: to } },
      orderBy: { occurredAt: 'asc' },
    });
    return rows.map(toRecipeView);
  }

  async recipesWithLines(restaurantId: string, branchId: string): Promise<RecipeCostingSource[]> {
    const rows = await this.prisma.recipe.findMany({
      where: { restaurantId, branchId, deletedAt: null },
      select: {
        id: true,
        menuItemId: true,
        costAmount: true,
        costUpdatedAt: true,
        lines: { select: { itemId: true, baseQty: true, netQty: true } },
      },
    });
    return rows.map((r) => ({
      recipeId: r.id,
      menuItemId: r.menuItemId,
      storedCostAmount: r.costAmount,
      costUpdatedAt: r.costUpdatedAt,
      lines: r.lines,
    }));
  }
}
