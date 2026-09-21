import { Inject, Injectable } from '@nestjs/common';
import { InventoryItem } from '../../domain/entities/inventory-item';
import { Recipe } from '../../domain/entities/recipe';
import { roundedDiv } from '../../domain/value-objects/money';
import { ITEM_UNIT_COST_READER, ItemUnitCostReader } from '../ports/item-unit-cost.reader';
import { PROCESS_GRAPH_READER, ProcessGraphReader } from '../ports/process-graph.reader';
import {
  DishProjection,
  DishProjectionResolver,
  Locale,
} from './dish-projection.resolver';
import { InventoryItemNameResolver } from './inventory-item-name.resolver';

const MICRO = 1_000_000;

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
  ) {}

  async assemble(recipe: Recipe, locale: Locale = 'en'): Promise<RecipeDetail> {
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
    return { recipe, estimatedUnitCostAmount, warnings, projection };
  }
}
