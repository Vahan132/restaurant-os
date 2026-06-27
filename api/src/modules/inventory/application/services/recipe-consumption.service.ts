import { Inject, Injectable } from '@nestjs/common';
import { StockMovementType } from '../../domain/enums';
import {
  STOCK_CONSUMPTION_PORT,
  StockConsumptionPort,
} from '../../domain/ports/stock-consumption.port';
import { RECIPE_REPOSITORY, RecipeRepository } from '../../domain/repositories/recipe.repository';

export interface ConsumeMenuItemCommand {
  restaurantId: string;
  menuItemId: string;
  /** Number of dish units (recipe is exploded × units). */
  units: number;
  type: StockMovementType;
  reason?: string | null;
  refType: string;
  refId: string;
  /** Selected modifier option ids (triggers their extra ModifierConsumptions). */
  modifierOptionIds?: string[];
  createdByUserId: string;
}

export interface MenuItemConsumptionResult {
  /** True if the menu item has a recipe (a dish with none consumes nothing). */
  hadRecipe: boolean;
  /** Total drawn cost across all ingredients (positive magnitude, minor units). */
  totalCostAmount: number;
  wentNegative: boolean;
  /** Ingredients whose on-hand went negative, for downstream warnings. */
  negativeItems: Array<{ itemId: string; shortfallBaseQty: number }>;
}

/**
 * RecipeConsumptionService — explodes a menu item's recipe (lines + the selected
 * modifier options' ModifierConsumptions) and draws each ingredient down via the
 * INV-1 consumption port. The single reusable place that turns "N of a dish" into
 * stock movements; used by the order→kitchen hook (INV-3) and dish write-offs
 * (INV-4). Consumption is keyed by the caller's (refType, refId) so it is
 * idempotent and reversible. Never throws on insufficient stock.
 */
@Injectable()
export class RecipeConsumptionService {
  constructor(
    @Inject(RECIPE_REPOSITORY) private readonly recipes: RecipeRepository,
    @Inject(STOCK_CONSUMPTION_PORT) private readonly consumption: StockConsumptionPort,
  ) {}

  async consumeMenuItem(command: ConsumeMenuItemCommand): Promise<MenuItemConsumptionResult> {
    const recipe = await this.recipes.findByMenuItemId(command.restaurantId, command.menuItemId);
    if (!recipe) {
      return { hadRecipe: false, totalCostAmount: 0, wentNegative: false, negativeItems: [] };
    }

    // Aggregate per ingredient so a recipe line + a modifier extra on the same
    // item become ONE consume (keeps idempotency per ref+item correct).
    const byItem = new Map<string, number>();
    for (const line of recipe.lines) {
      byItem.set(line.itemId, (byItem.get(line.itemId) ?? 0) + line.baseQty * command.units);
    }
    const selected = new Set(command.modifierOptionIds ?? []);
    for (const mc of recipe.modifierConsumptions) {
      if (selected.has(mc.modifierOptionId)) {
        byItem.set(mc.itemId, (byItem.get(mc.itemId) ?? 0) + mc.baseQty * command.units);
      }
    }

    let totalCostAmount = 0;
    let wentNegative = false;
    const negativeItems: Array<{ itemId: string; shortfallBaseQty: number }> = [];

    for (const [itemId, baseQty] of byItem) {
      const result = await this.consumption.consume({
        restaurantId: command.restaurantId,
        itemId,
        baseQty,
        type: command.type,
        reason: command.reason ?? null,
        refType: command.refType,
        refId: command.refId,
        createdByUserId: command.createdByUserId,
      });
      totalCostAmount += result.totalCostAmount;
      if (result.wentNegative) {
        wentNegative = true;
        negativeItems.push({ itemId, shortfallBaseQty: result.shortfallBaseQty });
      }
    }

    return { hadRecipe: true, totalCostAmount, wentNegative, negativeItems };
  }
}
