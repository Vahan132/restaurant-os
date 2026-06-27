import { Inject, Injectable } from '@nestjs/common';
import { Recipe } from '../../domain/entities/recipe';
import { roundedDiv } from '../../domain/value-objects/money';
import { ITEM_UNIT_COST_READER, ItemUnitCostReader } from '../ports/item-unit-cost.reader';
import { PROCESS_GRAPH_READER, ProcessGraphReader } from '../ports/process-graph.reader';

const MICRO = 1_000_000;

export type RecipeWarningType = 'HAS_PROCESSED_COUNTERPART' | 'HAS_RAW_SOURCE';

export interface RecipeWarning {
  itemId: string;
  type: RecipeWarningType;
  counterparts: Array<{ itemId: string; name: string }>;
}

export interface RecipeDetail {
  recipe: Recipe;
  estimatedUnitCostAmount: number;
  warnings: RecipeWarning[];
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
  ) {}

  async assemble(recipe: Recipe): Promise<RecipeDetail> {
    const lineItemIds = [...new Set(recipe.lines.map((l) => l.itemId))];

    const micros = await this.costs.unitCostMicroByItem(
      recipe.restaurantId,
      recipe.branchId,
      lineItemIds,
    );
    const estimatedUnitCostAmount = recipe.lines.reduce((sum, line) => {
      const micro = micros.get(line.itemId) ?? 0n;
      return sum + roundedDiv(line.baseQty * Number(micro), MICRO);
    }, 0);

    const warnings: RecipeWarning[] = [];
    for (const itemId of lineItemIds) {
      const related = await this.graph.related(recipe.restaurantId, recipe.branchId, itemId);
      if (related.processedOutputs.length > 0) {
        warnings.push({
          itemId,
          type: 'HAS_PROCESSED_COUNTERPART',
          counterparts: related.processedOutputs.map((i) => ({ itemId: i.id, name: i.name })),
        });
      }
      if (related.rawSources.length > 0) {
        warnings.push({
          itemId,
          type: 'HAS_RAW_SOURCE',
          counterparts: related.rawSources.map((i) => ({ itemId: i.id, name: i.name })),
        });
      }
    }

    return { recipe, estimatedUnitCostAmount, warnings };
  }
}
