import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CostChangeTrigger,
  ITEM_COST_TRACKER,
  ItemCostTracker,
} from '../../application/ports/item-cost-tracker';
import { StockMovementType } from '../../domain/enums';
import { StockConsumptionResult } from '../../domain/ports/stock-consumption.port';
import {
  CountAdjustmentResult,
  GatewayConsumeInput,
  InventoryLedgerGateway,
  RecordInboundInput,
  RecordReceiptInput,
  ReverseLedgerInput,
  RunProcessInput,
  RunProcessResult,
  SetCountedOnHandInput,
  TransferLedgerInput,
  TransferLedgerResult,
} from '../../domain/repositories/inventory-ledger.gateway';
import { PrismaInventoryLedgerGateway } from './prisma-inventory-ledger.gateway';

function triggerForOut(type: StockMovementType): CostChangeTrigger {
  switch (type) {
    case StockMovementType.WRITE_OFF_OUT:
      return 'WRITE_OFF';
    case StockMovementType.ADJUSTMENT_OUT:
      return 'ADJUSTMENT';
    case StockMovementType.PROCESS_OUT:
      return 'PROCESS_RUN';
    default:
      return 'CONSUMPTION';
  }
}

/**
 * COST-FIFO-1: decorates the ledger gateway (the single choke point for every
 * stock-layer write) so that AFTER each committed write the affected items'
 * current batch cost is re-evaluated — e.g. when the 300-dram batch runs out and
 * the 500-dram batch starts being consumed, the dish cost prices follow and the
 * switch is logged. Cost tracking is best-effort: it never fails the write.
 */
@Injectable()
export class CostTrackingInventoryLedgerGateway implements InventoryLedgerGateway {
  private readonly logger = new Logger(CostTrackingInventoryLedgerGateway.name);

  constructor(
    private readonly inner: PrismaInventoryLedgerGateway,
    @Inject(ITEM_COST_TRACKER) private readonly tracker: ItemCostTracker,
  ) {}

  private async track(
    restaurantId: string,
    branchId: string,
    itemIds: string[],
    trigger: CostChangeTrigger,
  ): Promise<void> {
    try {
      await this.tracker.refresh({ restaurantId, branchId, itemIds, trigger });
    } catch (err) {
      this.logger.warn(`Cost tracking (${trigger}) failed: ${(err as Error).message}`);
    }
  }

  async recordReceipt(input: RecordReceiptInput): Promise<void> {
    await this.inner.recordReceipt(input);
    const byBranch = new Map<string, string[]>();
    for (const l of input.layers) {
      const arr = byBranch.get(l.branchId) ?? [];
      arr.push(l.itemId);
      byBranch.set(l.branchId, arr);
    }
    for (const [branchId, itemIds] of byBranch) {
      await this.track(input.receipt.restaurantId, branchId, itemIds, 'RECEIPT');
    }
  }

  async recordInboundAdjustment(input: RecordInboundInput): Promise<void> {
    await this.inner.recordInboundAdjustment(input);
    await this.track(
      input.layer.restaurantId,
      input.layer.branchId,
      [input.layer.itemId],
      'ADJUSTMENT',
    );
  }

  async consume(input: GatewayConsumeInput): Promise<StockConsumptionResult> {
    const result = await this.inner.consume(input);
    await this.track(input.restaurantId, input.branchId, [input.itemId], triggerForOut(input.type));
    return result;
  }

  async runProcess(input: RunProcessInput): Promise<RunProcessResult> {
    const result = await this.inner.runProcess(input);
    const itemIds = [...input.inputs.map((i) => i.itemId), ...input.outputs.map((o) => o.itemId)];
    await this.track(input.run.restaurantId, input.run.branchId, itemIds, 'PROCESS_RUN');
    return result;
  }

  async reverse(input: ReverseLedgerInput): Promise<number> {
    const count = await this.inner.reverse(input);
    if (count > 0) {
      try {
        await this.tracker.refreshForRef(
          input.restaurantId,
          input.refType,
          input.refId,
          'REVERSAL',
        );
      } catch (err) {
        this.logger.warn(`Cost tracking (REVERSAL) failed: ${(err as Error).message}`);
      }
    }
    return count;
  }

  async transfer(input: TransferLedgerInput): Promise<TransferLedgerResult> {
    const result = await this.inner.transfer(input);
    await this.track(input.restaurantId, input.branchId, [input.itemId], 'TRANSFER');
    return result;
  }

  async setCountedOnHand(input: SetCountedOnHandInput): Promise<CountAdjustmentResult> {
    const result = await this.inner.setCountedOnHand(input);
    await this.track(input.restaurantId, input.branchId, [input.itemId], 'COUNT');
    return result;
  }
}
