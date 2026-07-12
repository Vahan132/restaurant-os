import { ApiProperty } from '@nestjs/swagger';
import { Recipe } from '../../domain/entities/recipe';
import { RecipeDetail, RecipeWarning } from '../services/recipe-detail.assembler';
import { DishProjection } from '../services/dish-projection.resolver';

export class RecipeLineResponse {
  @ApiProperty() id!: string;
  @ApiProperty() itemId!: string;
  @ApiProperty() baseQty!: number;
}

export class ModifierConsumptionResponse {
  @ApiProperty() id!: string;
  @ApiProperty() modifierOptionId!: string;
  @ApiProperty() itemId!: string;
  @ApiProperty() baseQty!: number;
}

export class RecipeWarningCounterpart {
  @ApiProperty() itemId!: string;
  @ApiProperty({ nullable: true, type: String, description: 'Live catalog name (adopted) or local name; null if unresolvable.' })
  name!: string | null;
}

export class RecipeWarningResponse {
  @ApiProperty() itemId!: string;
  @ApiProperty({ enum: ['HAS_PROCESSED_COUNTERPART', 'HAS_RAW_SOURCE'] }) type!: string;
  @ApiProperty({ type: [RecipeWarningCounterpart] }) counterparts!: RecipeWarningCounterpart[];

  static from(w: RecipeWarning): RecipeWarningResponse {
    return { itemId: w.itemId, type: w.type, counterparts: w.counterparts };
  }
}

/** Customer projection line (CATALOG-3): localized ingredient name, no quantity. */
export class CustomerIngredientResponse {
  @ApiProperty() itemId!: string;
  @ApiProperty() name!: string;
}

/** Operational projection line (CATALOG-3, owner): component + quantity + unit. */
export class OperationalIngredientResponse {
  @ApiProperty() itemId!: string;
  @ApiProperty() baseQty!: number;
  @ApiProperty({ description: 'From InventoryItem.baseUnit (GRAM | MILLILITER | PIECE).' })
  unit!: string;
}

/** Honest dish allergen rollup (CATALOG-3): union + completeness + unverified leaves. */
export class DishAllergensResponse {
  @ApiProperty({ type: [String], description: 'Union of effective allergen slugs over all leaves.' })
  slugs!: string[];
  @ApiProperty({
    description:
      'True only when every contributing leaf is verified (catalogSourced && reviewed). ' +
      'Never inferred from an empty slugs array (empty = known-none, not unknown).',
  })
  complete!: boolean;
  @ApiProperty({ type: [String], description: 'Leaf item ids that made the profile incomplete.' })
  unverifiedItemIds!: string[];
}

/** Full recipe view: lines + modifier consumptions + estimate + warnings (§3,§6). */
export class RecipeResponse {
  @ApiProperty() id!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty() menuItemId!: string;
  @ApiProperty({ nullable: true, type: String }) note!: string | null;
  @ApiProperty({ type: [RecipeLineResponse] }) lines!: RecipeLineResponse[];
  @ApiProperty({ type: [ModifierConsumptionResponse] })
  modifierConsumptions!: ModifierConsumptionResponse[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  @ApiProperty({ description: 'Forward-looking estimate (§3); NOT actual COGS.' })
  estimatedUnitCost_amount!: number;
  @ApiProperty({ type: [RecipeWarningResponse] }) warnings!: RecipeWarningResponse[];

  // ── CATALOG-3: hideRecipe + dual projections + allergen rollup ───────────────
  @ApiProperty({ description: 'Hides the customer ingredient list, never the allergens (ADR §9).' })
  hideRecipe!: boolean;
  @ApiProperty({
    type: [CustomerIngredientResponse],
    nullable: true,
    description: 'Localized ingredient names, no quantities. null when hideRecipe.',
  })
  customerIngredients!: CustomerIngredientResponse[] | null;
  @ApiProperty({ type: [OperationalIngredientResponse] })
  operationalIngredients!: OperationalIngredientResponse[];
  @ApiProperty({ type: DishAllergensResponse })
  allergens!: DishAllergensResponse;

  static from(detail: RecipeDetail): RecipeResponse {
    const p: DishProjection = detail.projection;
    return {
      ...RecipeResponse.base(detail.recipe),
      estimatedUnitCost_amount: detail.estimatedUnitCostAmount,
      warnings: detail.warnings.map(RecipeWarningResponse.from),
      hideRecipe: p.hideRecipe,
      customerIngredients: p.customerIngredients,
      operationalIngredients: p.operationalIngredients,
      allergens: p.allergens,
    };
  }

  private static base(
    r: Recipe,
  ): Omit<
    RecipeResponse,
    | 'estimatedUnitCost_amount'
    | 'warnings'
    | 'hideRecipe'
    | 'customerIngredients'
    | 'operationalIngredients'
    | 'allergens'
  > {
    return {
      id: r.id,
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      menuItemId: r.menuItemId,
      note: r.note,
      lines: r.lines.map((l) => ({ id: l.id, itemId: l.itemId, baseQty: l.baseQty })),
      modifierConsumptions: r.modifierConsumptions.map((m) => ({
        id: m.id,
        modifierOptionId: m.modifierOptionId,
        itemId: m.itemId,
        baseQty: m.baseQty,
      })),
    };
  }
}

/** Compact list row (no per-line warnings/estimate to keep listing cheap). */
export class RecipeListItemResponse {
  @ApiProperty() id!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty() menuItemId!: string;
  @ApiProperty({ nullable: true, type: String }) note!: string | null;
  @ApiProperty() lineCount!: number;

  static from(r: Recipe): RecipeListItemResponse {
    return {
      id: r.id,
      restaurantId: r.restaurantId,
      menuItemId: r.menuItemId,
      note: r.note,
      lineCount: r.lines.length,
    };
  }
}
