import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { PrismaItemCostTracker } from './prisma-item-cost-tracker';

type Layer = {
  id: string;
  itemId: string;
  locationId: string;
  baseQtyReceived: number;
  baseQtyRemaining: number;
  lineTotalCostAmount: number;
  receivedAt: Date;
  expiryDate: Date | null;
  sourceReceiptLineId: string | null;
  status: 'OPEN' | 'DEPLETED';
};

/**
 * Minimal in-memory Prisma double covering exactly the calls the tracker makes.
 * One branch "b1", one item "pepper" (grams), one recipe "r1" using 50 g brutto.
 */
function buildFake() {
  const item = {
    id: 'pepper',
    restaurantId: 'r',
    branchId: 'b1',
    trackExpiry: false,
    consumptionLocationId: null as string | null,
    lastUnitCostMicro: null as bigint | null,
    currentUnitCostMicro: null as bigint | null,
    deletedAt: null,
  };
  const recipe = {
    id: 'r1',
    restaurantId: 'r',
    branchId: 'b1',
    menuItemId: 'm1',
    costAmount: null as number | null,
    deletedAt: null,
    lines: [{ itemId: 'pepper', baseQty: 50 }],
  };
  const layers: Layer[] = [];
  const itemChanges: Array<Record<string, unknown>> = [];
  const recipeChanges: Array<Record<string, unknown>> = [];

  const prisma = {
    inventoryItem: {
      findMany: jest.fn(async () => [{ ...item }]), // Prisma returns copies
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { currentUnitCostMicro: bigint | null };
          data: { currentUnitCostMicro: bigint };
        }) => {
          if (item.currentUnitCostMicro !== where.currentUnitCostMicro) return { count: 0 };
          item.currentUnitCostMicro = data.currentUnitCostMicro;
          return { count: 1 };
        },
      ),
    },
    inventoryLocation: { findFirst: jest.fn(async () => ({ id: 'main' })) },
    stockLayer: {
      findMany: jest.fn(async () =>
        layers.filter((l) => l.status === 'OPEN' && l.baseQtyRemaining > 0),
      ),
    },
    goodsReceiptLine: {
      findMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map((id) => ({
          id,
          receipt: { supplierId: id === 'rl-500' ? 'sup-b' : 'sup-a' },
        })),
      ),
    },
    inventoryItemCostChange: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
        itemChanges.push(data),
      ),
    },
    recipeLine: { findMany: jest.fn(async () => [{ recipeId: 'r1' }]) },
    recipe: {
      findMany: jest.fn(async () => (recipe.deletedAt ? [] : [{ ...recipe }])),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { costAmount?: number | null };
          data: { costAmount: number };
        }) => {
          if ('costAmount' in where && recipe.costAmount !== where.costAmount) return { count: 0 };
          recipe.costAmount = data.costAmount;
          return { count: 1 };
        },
      ),
    },
    recipeCostChange: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
        recipeChanges.push(data),
      ),
    },
  };
  const tracker = new PrismaItemCostTracker(prisma as unknown as PrismaService);
  return { tracker, item, recipe, layers, itemChanges, recipeChanges };
}

const layer = (id: string, cost: number, day: number, lineId: string): Layer => ({
  id,
  itemId: 'pepper',
  locationId: 'main',
  baseQtyReceived: 1000,
  baseQtyRemaining: 1000,
  lineTotalCostAmount: cost,
  receivedAt: new Date(Date.UTC(2026, 8, day)),
  expiryDate: null,
  sourceReceiptLineId: lineId,
  status: 'OPEN',
});

describe('PrismaItemCostTracker (COST-FIFO-1)', () => {
  const refresh = (t: PrismaItemCostTracker, trigger: 'RECEIPT' | 'CONSUMPTION') =>
    t.refresh({ restaurantId: 'r', branchId: 'b1', itemIds: ['pepper'], trigger });

  it('keeps the old batch price until it runs out, then switches the dish cost and logs it', async () => {
    const f = buildFake();
    await f.tracker.setRecipeBaseline('r', 'r1', 0);
    f.recipe.costAmount = null; // simulate a never-costed dish

    // Monday: 1 kg at 300 arrives -> current = 300/kg, dish baseline set (no dish log).
    f.layers.push(layer('L300', 300, 21, 'rl-300'));
    await refresh(f.tracker, 'RECEIPT');
    expect(f.item.currentUnitCostMicro).toBe(300_000n);
    expect(f.recipe.costAmount).toBe(15);
    expect(f.itemChanges).toHaveLength(1);
    expect(f.recipeChanges).toHaveLength(0);

    // Tuesday: 1 kg at 500 arrives, but the 300 batch is still being used -> no change.
    f.layers.push(layer('L500', 500, 22, 'rl-500'));
    await refresh(f.tracker, 'RECEIPT');
    expect(f.item.currentUnitCostMicro).toBe(300_000n);
    expect(f.recipe.costAmount).toBe(15);
    expect(f.itemChanges).toHaveLength(1);

    // The 300 batch is depleted by sales -> the 500 batch starts being used.
    f.layers[0].baseQtyRemaining = 0;
    f.layers[0].status = 'DEPLETED';
    const res = await refresh(f.tracker, 'CONSUMPTION');
    expect(res.changedItemIds).toEqual(['pepper']);
    expect(res.changedRecipeIds).toEqual(['r1']);
    expect(f.item.currentUnitCostMicro).toBe(500_000n);
    expect(f.recipe.costAmount).toBe(25);
    expect(f.itemChanges[1]).toMatchObject({
      oldUnitCostMicro: 300_000n,
      newUnitCostMicro: 500_000n,
      layerId: 'L500',
      supplierId: 'sup-b',
      trigger: 'CONSUMPTION',
    });
    expect(f.recipeChanges[0]).toMatchObject({
      recipeId: 'r1',
      menuItemId: 'm1',
      oldCostAmount: 15,
      newCostAmount: 25,
      causeItemId: 'pepper',
    });

    // Re-running with nothing changed is a no-op.
    await refresh(f.tracker, 'CONSUMPTION');
    expect(f.itemChanges).toHaveLength(2);
    expect(f.recipeChanges).toHaveLength(1);
  });

  it('keeps the last known cost when stock runs out (dish never drops to zero)', async () => {
    const f = buildFake();
    f.layers.push(layer('L300', 300, 21, 'rl-300'));
    await refresh(f.tracker, 'RECEIPT');
    f.layers[0].baseQtyRemaining = 0;
    f.layers[0].status = 'DEPLETED';
    const costs = await f.tracker.currentBatchCosts('r', 'b1', ['pepper']);
    expect(costs.get('pepper')).toMatchObject({ unitCostMicro: 300_000n, source: 'LAST_KNOWN' });
  });

  it('does not log a baseline fill as a price change on RECONCILE', async () => {
    const f = buildFake();
    f.layers.push(layer('L300', 300, 21, 'rl-300'));
    await f.tracker.refresh({
      restaurantId: 'r',
      branchId: 'b1',
      itemIds: ['pepper'],
      trigger: 'RECONCILE',
    });
    expect(f.item.currentUnitCostMicro).toBe(300_000n);
    expect(f.itemChanges).toHaveLength(0);
  });
});
