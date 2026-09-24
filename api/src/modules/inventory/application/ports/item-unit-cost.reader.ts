export const ITEM_UNIT_COST_READER = Symbol('ItemUnitCostReader');

/**
 * Forward-looking unit-cost estimate per item (for recipe cost rollup, §3).
 * Returns cost-per-base-unit at MICRO precision (×1,000,000). COST-FIFO-1: the
 * unit cost of the batch currently being consumed (next FIFO/FEFO open layer),
 * else the last known cost, else 0.
 * This is an ESTIMATE only — actual COGS is the real FIFO cost on the movements.
 */
export interface ItemUnitCostReader {
  unitCostMicroByItem(
    restaurantId: string,
    branchId: string,
    itemIds: string[],
  ): Promise<Map<string, bigint>>;
}
