import { ApiProperty } from '@nestjs/swagger';
import { Recipe } from '../../domain/entities/recipe';
import { RecipeCostChangeView } from '../ports/cost-history.reader';
import { MenuCostingRow } from '../queries/get-menu-costing.usecase';
import { RecipeDetail, RecipeLineCost, RecipeWarning } from '../services/recipe-detail.assembler';
import { DishProjection } from '../services/dish-projection.resolver';

export class RecipeLineResponse {
  @ApiProperty() id!: string;
  @ApiProperty() itemId!: string;
  @ApiProperty({ description: 'BRUTTO per dish (deducted from stock, used for cost).' })
  baseQty!: number;
  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'NETTO per dish after cleaning/trimming; null = same as brutto.',
  })
  netQty!: number | null;
  @ApiProperty({ description: 'Cleaning/trim loss in basis points ((brutto-netto)/brutto).' })
  lossBps!: number;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  @ApiProperty({ description: 'Brutto x current batch unit cost (minor units, estimate).' })
  lineCost_amount!: number;
}

export class ModifierConsumptionResponse {
  @ApiProperty() id!: string;
  @ApiProperty() modifierOptionId!: string;
  @ApiProperty() itemId!: string;
  @ApiProperty() baseQty!: number;
}

export class RecipeWarningCounterpart {
  @ApiProperty() itemId!: string;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Live catalog name (adopted) or local name; null if unresolvable.',
  })
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

/** COST-FIFO-1: one dish cost-price change (newest first in RecipeResponse). */
export class RecipeCostChangeResponse {
  @ApiProperty() id!: string;
  @ApiProperty() recipeId!: string;
  @ApiProperty() menuItemId!: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  @ApiProperty({ nullable: true, type: Number }) oldCost_amount!: number | null;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  @ApiProperty() newCost_amount!: number;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Ingredient whose new batch price caused the change.',
  })
  causeItemId!: string | null;
  @ApiProperty() occurredAt!: string;

  static from(c: RecipeCostChangeView): RecipeCostChangeResponse {
    return {
      id: c.id,
      recipeId: c.recipeId,
      menuItemId: c.menuItemId,
      oldCost_amount: c.oldCostAmount,
      newCost_amount: c.newCostAmount,
      causeItemId: c.causeItemId,
      occurredAt: c.occurredAt.toISOString(),
    };
  }
}

/** COST-FIFO-1: how a recipe line is costed right now. */
export class RecipeLineCostResponse {
  @ApiProperty() lineId!: string;
  @ApiProperty() itemId!: string;
  @ApiProperty({ description: 'Current batch unit cost per base unit, MICRO (BigInt string).' })
  unitCostMicro!: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  @ApiProperty({ description: 'Brutto x unit cost, minor units.' }) cost_amount!: number;
  @ApiProperty({ enum: ['BATCH', 'LAST_KNOWN', 'NONE'] }) source!: string;
  @ApiProperty({ nullable: true, type: String }) supplierId!: string | null;
  @ApiProperty({ nullable: true, type: String }) batchReceivedAt!: string | null;

  static from(l: RecipeLineCost): RecipeLineCostResponse {
    return {
      lineId: l.lineId,
      itemId: l.itemId,
      unitCostMicro: l.unitCostMicro.toString(),
      cost_amount: l.costAmount,
      source: l.source,
      supplierId: l.supplierId,
      batchReceivedAt: l.batchReceivedAt ? l.batchReceivedAt.toISOString() : null,
    };
  }
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
  @ApiProperty({ type: [RecipeLineCostResponse], description: 'COST-FIFO-1 per-line costing.' })
  lineCosts!: RecipeLineCostResponse[];
  @ApiProperty({
    type: [RecipeCostChangeResponse],
    description: 'COST-FIFO-1: recent dish cost-price changes, newest first.',
  })
  costHistory!: RecipeCostChangeResponse[];

  // ── CATALOG-3: hideRecipe + dual projections ────────────────────────────────
  @ApiProperty({ description: 'Hides the customer ingredient list (ADR §9).' })
  hideRecipe!: boolean;
  @ApiProperty({
    type: [CustomerIngredientResponse],
    nullable: true,
    description: 'Localized ingredient names, no quantities. null when hideRecipe.',
  })
  customerIngredients!: CustomerIngredientResponse[] | null;
  @ApiProperty({ type: [OperationalIngredientResponse] })
  operationalIngredients!: OperationalIngredientResponse[];

  static from(detail: RecipeDetail): RecipeResponse {
    const p: DishProjection = detail.projection;
    const base = RecipeResponse.base(detail.recipe);
    const costByLine = new Map(detail.lineCosts.map((c) => [c.lineId, c.costAmount]));
    return {
      ...base,
      lines: base.lines.map((l) => ({ ...l, lineCost_amount: costByLine.get(l.id) ?? 0 })),
      lineCosts: detail.lineCosts.map(RecipeLineCostResponse.from),
      costHistory: detail.costHistory.map(RecipeCostChangeResponse.from),
      estimatedUnitCost_amount: detail.estimatedUnitCostAmount,
      warnings: detail.warnings.map(RecipeWarningResponse.from),
      hideRecipe: p.hideRecipe,
      customerIngredients: p.customerIngredients,
      operationalIngredients: p.operationalIngredients,
    };
  }

  private static base(
    r: Recipe,
  ): Omit<
    RecipeResponse,
    | 'estimatedUnitCost_amount'
    | 'warnings'
    | 'lineCosts'
    | 'costHistory'
    | 'hideRecipe'
    | 'customerIngredients'
    | 'operationalIngredients'
  > {
    return {
      id: r.id,
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      menuItemId: r.menuItemId,
      note: r.note,
      lines: r.lines.map((l) => ({
        id: l.id,
        itemId: l.itemId,
        baseQty: l.baseQty,
        netQty: l.netQty,
        lossBps: l.lossBps,
        lineCost_amount: 0,
      })),
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

/** COST-FIFO-1: one row of the menu costing list. */
export class MenuCostingRowResponse {
  @ApiProperty() recipeId!: string;
  @ApiProperty() menuItemId!: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  @ApiProperty({ description: 'Live dish cost price (brutto x current batch cost).' })
  cost_amount!: number;
  @ApiProperty() hasUncostedIngredient!: boolean;
  @ApiProperty({ type: RecipeCostChangeResponse, nullable: true })
  lastChange!: RecipeCostChangeResponse | null;

  static from(r: MenuCostingRow): MenuCostingRowResponse {
    return {
      recipeId: r.recipeId,
      menuItemId: r.menuItemId,
      cost_amount: r.costAmount,
      hasUncostedIngredient: r.hasUncostedIngredient,
      lastChange: r.lastChange ? RecipeCostChangeResponse.from(r.lastChange) : null,
    };
  }
}

export class RecalculateCostsResponse {
  @ApiProperty() changedItems!: number;
  @ApiProperty() changedDishes!: number;
}
