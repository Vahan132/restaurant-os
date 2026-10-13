import { Inject, Injectable } from '@nestjs/common';
import { recipeCostAmount } from '../../domain/services/recipe-costing';
import { NoRestaurantInScope } from '../application.errors';
import {
  COST_HISTORY_READER,
  CostHistoryReader,
  RecipeCostChangeView,
} from '../ports/cost-history.reader';
import { CostRefreshResult, ITEM_COST_TRACKER, ItemCostTracker } from '../ports/item-cost-tracker';

export interface MenuCostingRow {
  recipeId: string;
  menuItemId: string;
  /** Live dish cost price (Σ brutto x current batch cost), minor units. */
  costAmount: number;
  /** True when at least one ingredient has no known cost yet. */
  hasUncostedIngredient: boolean;
  lastChange: RecipeCostChangeView | null;
}

/**
 * COST-FIFO-1: dish cost price for every recipe in the active branch, computed
 * live from the batch each ingredient is CURRENTLY consumed from, plus the most
 * recent logged cost-price change (old -> new, which ingredient, when).
 */
@Injectable()
export class GetMenuCostingUseCase {
  constructor(
    @Inject(ITEM_COST_TRACKER) private readonly tracker: ItemCostTracker,
    @Inject(COST_HISTORY_READER) private readonly history: CostHistoryReader,
  ) {}

  async execute(input: {
    restaurantId: string | null;
    branchId: string;
  }): Promise<MenuCostingRow[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const restaurantId = input.restaurantId;
    const sources = await this.history.recipesWithLines(restaurantId, input.branchId);
    const itemIds = [...new Set(sources.flatMap((s) => s.lines.map((l) => l.itemId)))];
    const costs = await this.tracker.currentBatchCosts(restaurantId, input.branchId, itemIds);
    const micros = new Map<string, bigint>();
    for (const [id, c] of costs) {
      if (c.unitCostMicro !== null) micros.set(id, c.unitCostMicro);
    }
    const latest = await this.history.latestRecipeChanges(
      restaurantId,
      input.branchId,
      sources.map((s) => s.recipeId),
    );
    return sources.map((s) => ({
      recipeId: s.recipeId,
      menuItemId: s.menuItemId,
      costAmount: recipeCostAmount(s.lines, micros),
      hasUncostedIngredient: s.lines.some((l) => !micros.get(l.itemId)),
      lastChange: latest.get(s.recipeId) ?? null,
    }));
  }
}

/** COST-FIFO-1: force a full cost re-evaluation of the active branch (on demand). */
@Injectable()
export class RecalculateCostsUseCase {
  constructor(@Inject(ITEM_COST_TRACKER) private readonly tracker: ItemCostTracker) {}

  async execute(input: {
    restaurantId: string | null;
    branchId: string;
  }): Promise<CostRefreshResult> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    return this.tracker.reconcileBranch(input.restaurantId, input.branchId);
  }
}
