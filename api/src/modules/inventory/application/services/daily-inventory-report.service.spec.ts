import { CostHistoryReader } from '../ports/cost-history.reader';
import { DailyInventorySource, LedgerBucket } from '../ports/daily-inventory.source';
import { previousDate } from '../queries/get-daily-inventory-report.usecase';
import { DailyInventoryReportService } from './daily-inventory-report.service';
import { InventoryItemNameResolver } from './inventory-item-name.resolver';

describe('DailyInventoryReportService (DAILY-INV-1)', () => {
  const opening: LedgerBucket[] = [
    { itemId: 'pepper', type: 'RECEIPT_IN', refType: 'GOODS_RECEIPT', qty: 1000, cost: 300 },
    { itemId: 'idle', type: 'RECEIPT_IN', refType: 'GOODS_RECEIPT', qty: 0, cost: 0 },
  ];
  const day: LedgerBucket[] = [
    { itemId: 'pepper', type: 'RECEIPT_IN', refType: 'GOODS_RECEIPT', qty: 1000, cost: 500 },
    { itemId: 'pepper', type: 'CONSUMPTION_OUT', refType: 'ORDER_LINE', qty: -600, cost: -200 },
    { itemId: 'pepper', type: 'CONSUMPTION_REVERSAL', refType: 'ORDER_LINE', qty: 50, cost: 15 },
    { itemId: 'pepper', type: 'WRITE_OFF_OUT', refType: 'WRITE_OFF', qty: -100, cost: -30 },
    { itemId: 'pepper', type: 'ADJUSTMENT_OUT', refType: 'COUNT_ADJUSTMENT', qty: -20, cost: -6 },
  ];

  const source: DailyInventorySource = {
    ledgerBuckets: jest.fn(async (_r, _b, from) => (from ? day : opening)),
    itemsInfo: jest.fn(async () => [
      {
        id: 'pepper',
        name: 'Pepper',
        catalogItemId: null,
        baseUnit: 'GRAM',
        alternateUnits: [{ name: 'kg', factor: 1000 }],
        categoryId: null,
        categoryName: 'Veg',
        currentUnitCostMicro: 500_000n,
      },
    ]),
    menuItemNames: jest.fn(async () => new Map([['m1', 'Salad']])),
    restaurantTimezone: jest.fn(async () => 'Asia/Yerevan'),
    findSnapshot: jest.fn(async () => null),
    saveSnapshot: jest.fn(async () => undefined),
    scheduledBranches: jest.fn(async () => []),
  };
  const history = {
    itemChangesBetween: jest.fn(async () => []),
    recipeChangesBetween: jest.fn(async () => [
      {
        id: 'c1',
        recipeId: 'r1',
        menuItemId: 'm1',
        oldCostAmount: 15,
        newCostAmount: 25,
        causeItemId: 'pepper',
        occurredAt: new Date('2026-09-23T12:00:00Z'),
      },
    ]),
  } as unknown as CostHistoryReader;
  const names = {
    resolveMany: jest.fn(async () => new Map()),
  } as unknown as InventoryItemNameResolver;

  it('rolls opening -> movements -> closing per item and in total', async () => {
    const svc = new DailyInventoryReportService(source, history, names);
    const rep = await svc.build(
      'r',
      'b1',
      '2026-09-23',
      'Asia/Yerevan',
      new Date('2026-09-24T08:00:00Z'),
    );

    expect(rep.inProgress).toBe(false);
    expect(rep.items.map((i) => i.itemId)).toEqual(['pepper']); // idle item dropped
    const p = rep.items[0];
    expect(p.opening).toEqual({ qty: 1000, value: 300 });
    expect(p.received).toEqual({ qty: 1000, value: 500 });
    expect(p.sold).toEqual({ qty: -550, value: -185 }); // net of the voided line
    expect(p.wasted).toEqual({ qty: -100, value: -30 });
    expect(p.countVariance).toEqual({ qty: -20, value: -6 });
    expect(p.closing).toEqual({ qty: 1330, value: 579 });
    expect(rep.totals.closingValue).toBe(579);
    expect(rep.totals.soldValue).toBe(-185);
    expect(rep.dishCostChanges[0]).toMatchObject({
      menuItemName: 'Salad',
      causeItemName: 'Pepper',
      oldCostAmount: 15,
      newCostAmount: 25,
    });
  });

  it('previousDate crosses month/year boundaries', () => {
    expect(previousDate('2026-03-01')).toBe('2026-02-28');
    expect(previousDate('2027-01-01')).toBe('2026-12-31');
  });
});
