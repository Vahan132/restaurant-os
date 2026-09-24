import { Inject, Injectable, Optional } from '@nestjs/common';
import { InventoryItem } from '../../domain/entities/inventory-item';
import { Recipe } from '../../domain/entities/recipe';
import { lineCostAmount } from '../../domain/services/recipe-costing';
import {
  COST_HISTORY_READER,
  CostHistoryReader,
  RecipeCostChangeView,
} from '../ports/cost-history.reader';
import { CurrentBatchCost, ITEM_COST_TRACKER, ItemCostTracker } from '../ports/item-cost-tracker';
import { ITEM_UNIT_COST_READER, ItemUnitCostReader } from '../ports/item-unit-cost.reader';
import { PROCESS_GRAPH_READER, ProcessGraphReader } from '../ports/process-graph.reader';
import { DishProjection, DishProjectionResolver, Locale } from './dish-projection.resolver';
import { InventoryItemNameResolver } from './inventory-item-name.resolver';

/** COST-FIFO-1: how one recipe line is costed right now (brutto x current batch). */
export interface RecipeLineCost {
  lineId: string;
  itemId: string;
  unitCostMicro: bigint;
  costAmount: number;
  source: CurrentBatchCost['source'];
  supplierId: string | null;
  batchReceivedAt: Date | null;
}

export type RecipeWarningType = 'HAS_PROCESSED_COUNTERPART' | 'HAS_RAW_SOURCE';

export interface RecipeWarning {
  itemId: string;
  type: RecipeWarningType;
  /** PLATCAT-ADOPT-1B: name is the live catalog name (adopted) or local name; null only if unresolvable. */
  counterparts: Array<{ itemId: string; name: string | null }>;
}

export interface RecipeDetail {
  recipe: Recipe;
  estimatedUnitCostAmount: number;
  /** COST-FIFO-1: per-line cost breakdown (same order as recipe.lines). */
  lineCosts: RecipeLineCost[];
  /** COST-FIFO-1: most recent dish cost-price changes, newest first. */
  costHistory: RecipeCostChangeView[];
  warnings: RecipeWarning[];
  /** CATALOG-3: the customer + operational projections (one resolver). */
  projection: DishProjection;
}

/**
 * Computes a recipe's forward-looking estimated unit cost (§3) and the
 * non-blocking raw/processed counterpart warnings (§6). Used by recipe create,
 * update, and GET/:id so all three return the same enriched view.
 */
@Injectable()
export class RecipeDetailAssembler {
  constructor(
    @Inject(ITEM_UNIT_COST_READER) private readonly costs: ItemUnitCostReader,
    @Inject(PROCESS_GRAPH_READER) private readonly graph: ProcessGraphReader,
    private readonly dish: DishProjectionResolver,
    private readonly names: InventoryItemNameResolver,
    @Optional() @Inject(ITEM_COST_TRACKER) private readonly tracker?: ItemCostTracker,
    @Optional() @Inject(COST_HISTORY_READER) private readonly history?: CostHistoryReader,
  ) {}

  async assemble(recipe: Recipe, locale: Locale = 'en'): Promise<RecipeDetail> {
    const lineItemIds = [...new Set(recipe.lines.map((l) => l.itemId))];

    const micros = await this.costs.unitCostMicroByItem(
      recipe.restaurantId,
      recipe.branchId,
      lineItemIds,
    );
    // COST-FIFO-1: supplier / batch context per ingredient (best-effort).
    const batches = this.tracker
      ? await this.tracker.currentBatchCosts(recipe.restaurantId, recipe.branchId, lineItemIds)
      : new Map<string, CurrentBatchCost>();
    // BRUTTO-1: cost is on BRUTTO (baseQty) — what actually leaves stock.
    const lineCosts: RecipeLineCost[] = recipe.lines.map((line) => {
      const micro = micros.get(line.itemId) ?? 0n;
      const b = batches.get(line.itemId);
      return {
        lineId: line.id,
        itemId: line.itemId,
        unitCostMicro: micro,
        costAmount: lineCostAmount(line.baseQty, micro),
        source: b?.source ?? (micro > 0n ? 'BATCH' : 'NONE'),
        supplierId: b?.supplierId ?? null,
        batchReceivedAt: b?.receivedAt ?? null,
      };
    });
    const estimatedUnitCostAmount = lineCosts.reduce((sum, l) => sum + l.costAmount, 0);
    const costHistory = this.history
      ? await this.history.recipeChanges(recipe.restaurantId, recipe.branchId, recipe.id, 20)
      : [];

    const warnings: RecipeWarning[] = [];
    const counterpartItems: InventoryItem[] = [];
    for (const itemId of lineItemIds) {
      const related = await this.graph.related(recipe.restaurantId, recipe.branchId, itemId);
      if (related.processedOutputs.length > 0) {
        counterpartItems.push(...related.processedOutputs);
        warnings.push({
          itemId,
          type: 'HAS_PROCESSED_COUNTERPART',
          counterparts: related.processedOutputs.map((i) => ({ itemId: i.id, name: i.name })),
        });
      }
      if (related.rawSources.length > 0) {
        counterpartItems.push(...related.rawSources);
        warnings.push({
          itemId,
          type: 'HAS_RAW_SOURCE',
          counterparts: related.rawSources.map((i) => ({ itemId: i.id, name: i.name })),
        });
      }
    }

    // PLATCAT-ADOPT-1B: an adopted counterpart has name = null; resolve its live
    // catalog name (batched) and pick the active locale so warnings never show blank.
    const counterpartNames = await this.names.resolveMany(
      counterpartItems.map((i) => ({ id: i.id, catalogItemId: i.catalogItemId })),
    );
    for (const w of warnings) {
      for (const c of w.counterparts) {
        const cn = counterpartNames.get(c.itemId);
        if (cn) {
          c.name = cn[locale];
        }
      }
    }

    const projection = await this.dish.resolve(recipe, locale);
    return { recipe, estimatedUnitCostAmount, lineCosts, costHistory, warnings, projection };
  }
}
