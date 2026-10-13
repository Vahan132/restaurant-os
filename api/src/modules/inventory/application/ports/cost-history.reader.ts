export const COST_HISTORY_READER = Symbol('CostHistoryReader');

/** COST-FIFO-1: one logged change of an ingredient's current batch cost. */
export interface ItemCostChangeView {
  id: string;
  itemId: string;
  oldUnitCostMicro: bigint | null;
  newUnitCostMicro: bigint;
  layerId: string | null;
  supplierId: string | null;
  supplierName: string | null;
  trigger: string;
  occurredAt: Date;
}

/** COST-FIFO-1: one logged change of a dish's cost price. */
export interface RecipeCostChangeView {
  id: string;
  recipeId: string;
  menuItemId: string;
  oldCostAmount: number | null;
  newCostAmount: number;
  causeItemId: string | null;
  occurredAt: Date;
}

export interface RecipeCostingSource {
  recipeId: string;
  menuItemId: string;
  storedCostAmount: number | null;
  costUpdatedAt: Date | null;
  lines: Array<{ itemId: string; baseQty: number; netQty: number | null }>;
}

/** Read model over the cost-price history tables + the recipes needing costing. */
export interface CostHistoryReader {
  recipeChanges(
    restaurantId: string,
    branchId: string,
    recipeId: string,
    limit: number,
  ): Promise<RecipeCostChangeView[]>;

  /** Latest change per recipe (for the menu costing list). */
  latestRecipeChanges(
    restaurantId: string,
    branchId: string,
    recipeIds: string[],
  ): Promise<Map<string, RecipeCostChangeView>>;

  itemChangesBetween(
    restaurantId: string,
    branchId: string,
    from: Date,
    to: Date,
  ): Promise<ItemCostChangeView[]>;

  recipeChangesBetween(
    restaurantId: string,
    branchId: string,
    from: Date,
    to: Date,
  ): Promise<RecipeCostChangeView[]>;

  /** Every live recipe of the branch with its lines (menu costing). */
  recipesWithLines(restaurantId: string, branchId: string): Promise<RecipeCostingSource[]>;
}
