export const ITEM_COST_TRACKER = Symbol('ItemCostTracker');

/** What caused an item's current batch cost to be re-evaluated. */
export type CostChangeTrigger =
  | 'RECEIPT'
  | 'CONSUMPTION'
  | 'WRITE_OFF'
  | 'PROCESS_RUN'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'COUNT'
  | 'REVERSAL'
  | 'RECONCILE';

/**
 * COST-FIFO-1: the unit cost of the batch an item is CURRENTLY consumed from.
 *  - BATCH: the next FIFO/FEFO open layer (at the item's consumption location when
 *    it holds stock there, else anywhere in the branch).
 *  - LAST_KNOWN: no open stock — the last known cost (previous current batch, else
 *    the last receipt price) so a dish never drops to zero cost when stock runs out.
 *  - NONE: never had a cost.
 */
export interface CurrentBatchCost {
  itemId: string;
  unitCostMicro: bigint | null;
  source: 'BATCH' | 'LAST_KNOWN' | 'NONE';
  layerId: string | null;
  supplierId: string | null;
  receivedAt: Date | null;
}

export interface CostRefreshResult {
  changedItemIds: string[];
  changedRecipeIds: string[];
}

/**
 * Keeps InventoryItem.currentUnitCostMicro and Recipe.costAmount in step with the
 * batch actually being consumed, and logs every change (item + dish) so admins
 * can see WHEN a new supplier price started to affect a dish's cost price.
 * All methods are best-effort and idempotent (compare-and-set).
 */
export interface ItemCostTracker {
  /** Live current-batch cost per item (no writes). */
  currentBatchCosts(
    restaurantId: string,
    branchId: string,
    itemIds: string[],
  ): Promise<Map<string, CurrentBatchCost>>;

  /** Re-evaluate the given items after a ledger write; cascade to dish costs. */
  refresh(input: {
    restaurantId: string;
    branchId: string;
    itemIds: string[];
    trigger: CostChangeTrigger;
    occurredAt?: Date;
  }): Promise<CostRefreshResult>;

  /** Re-evaluate every item touched by a ledger ref (e.g. after a reversal). */
  refreshForRef(
    restaurantId: string,
    refType: string,
    refId: string,
    trigger: CostChangeTrigger,
  ): Promise<void>;

  /** Set a dish's cost baseline without logging (recipe created/edited). */
  setRecipeBaseline(restaurantId: string, recipeId: string, costAmount: number): Promise<void>;

  /** Full re-evaluation of a branch (nightly / on demand). */
  reconcileBranch(restaurantId: string, branchId: string): Promise<CostRefreshResult>;
}
