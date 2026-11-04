import { ItemCostTracker } from '../../application/ports/item-cost-tracker';
import { StockMovementType } from '../../domain/enums';
import { GatewayConsumeInput } from '../../domain/repositories/inventory-ledger.gateway';
import { CostTrackingInventoryLedgerGateway } from './cost-tracking-ledger.gateway';
import { PrismaInventoryLedgerGateway } from './prisma-inventory-ledger.gateway';

const consumeInput = (type: StockMovementType): GatewayConsumeInput => ({
  restaurantId: 'r',
  branchId: 'b1',
  itemId: 'pepper',
  baseQty: 50,
  type,
  reason: null,
  refType: 'ORDER_LINE',
  refId: 'ol1',
  createdByUserId: 'u',
  occurredAt: new Date(),
  trackExpiry: false,
  lastUnitCostMicro: null,
});

describe('CostTrackingInventoryLedgerGateway (COST-FIFO-1)', () => {
  const RESULT = { itemId: 'pepper' };

  function build(refresh: jest.Mock) {
    const inner = { consume: jest.fn(async () => RESULT) };
    const tracker = { refresh } as unknown as ItemCostTracker;
    const gw = new CostTrackingInventoryLedgerGateway(
      inner as unknown as PrismaInventoryLedgerGateway,
      tracker,
    );
    return { gw, inner };
  }

  it('re-evaluates the item cost after a committed consumption', async () => {
    const refresh = jest.fn(async () => ({ changedItemIds: [], changedRecipeIds: [] }));
    const { gw, inner } = build(refresh);
    await expect(gw.consume(consumeInput(StockMovementType.CONSUMPTION_OUT))).resolves.toBe(RESULT);
    expect(inner.consume).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledWith({
      restaurantId: 'r',
      branchId: 'b1',
      itemIds: ['pepper'],
      trigger: 'CONSUMPTION',
    });
  });

  it('labels write-offs and never fails the write when tracking fails', async () => {
    const refresh = jest.fn(async () => {
      throw new Error('db down');
    });
    const { gw } = build(refresh);
    await expect(gw.consume(consumeInput(StockMovementType.WRITE_OFF_OUT))).resolves.toBe(RESULT);
    expect(refresh).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'WRITE_OFF' }));
  });
});
