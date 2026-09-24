import { Inject, Injectable } from '@nestjs/common';
import { ItemUnitCostReader } from '../../application/ports/item-unit-cost.reader';
import { ITEM_COST_TRACKER, ItemCostTracker } from '../../application/ports/item-cost-tracker';

/**
 * Per-item unit-cost estimate at MICRO precision (§3), COST-FIFO-1 semantics: the
 * unit cost of the batch CURRENTLY being consumed (next FIFO/FEFO open layer), so a
 * dish's cost price switches exactly when a new supplier batch starts being used.
 * With no open stock it falls back to the last known cost, else 0. Estimate only —
 * actual COGS is the real FIFO cost on the movements.
 */
@Injectable()
export class PrismaItemUnitCostReader implements ItemUnitCostReader {
  constructor(@Inject(ITEM_COST_TRACKER) private readonly tracker: ItemCostTracker) {}

  async unitCostMicroByItem(
    restaurantId: string,
    branchId: string,
    itemIds: string[],
  ): Promise<Map<string, bigint>> {
    const costs = await this.tracker.currentBatchCosts(restaurantId, branchId, itemIds);
    const result = new Map<string, bigint>();
    for (const id of itemIds) {
      result.set(id, costs.get(id)?.unitCostMicro ?? 0n);
    }
    return result;
  }
}
