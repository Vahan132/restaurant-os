import { RecipeLine } from '../entities/recipe';
import { lineCostAmount, recipeCostAmount } from './recipe-costing';

describe('recipe costing (COST-FIFO-1 / BRUTTO-1)', () => {
  it('costs a line as brutto x MICRO unit cost, HALF_UP', () => {
    // 50 g at 0.6 minor units/g (600_000 micro) = 30
    expect(lineCostAmount(50, 600_000n)).toBe(30);
    // 3 g at 0.5 = 1.5 -> 2 (half-up)
    expect(lineCostAmount(3, 500_000n)).toBe(2);
    expect(lineCostAmount(10, null)).toBe(0);
    expect(lineCostAmount(0, 1_000_000n)).toBe(0);
  });

  it('sums a dish from the current batch cost of each ingredient', () => {
    const micros = new Map<string, bigint>([
      ['pepper', 600_000n],
      ['oil', 2_000_000n],
    ]);
    const cost = recipeCostAmount(
      [
        { itemId: 'pepper', baseQty: 50 },
        { itemId: 'oil', baseQty: 10 },
        { itemId: 'uncosted', baseQty: 5 },
      ],
      micros,
    );
    expect(cost).toBe(30 + 20);
  });

  it('a new supplier price (300 -> 500 per kg) changes the dish cost', () => {
    const line = [{ itemId: 'pepper', baseQty: 50 }];
    const at300 = recipeCostAmount(line, new Map([['pepper', 300_000n]])); // 300 / 1000 g
    const at500 = recipeCostAmount(line, new Map([['pepper', 500_000n]]));
    expect(at300).toBe(15);
    expect(at500).toBe(25);
  });
});

describe('RecipeLine brutto/netto (BRUTTO-1)', () => {
  it('exposes netto and the cleaning loss', () => {
    const l = new RecipeLine({
      id: 'l1',
      branchId: 'b',
      itemId: 'pepper',
      baseQty: 50,
      netQty: 40,
    });
    expect(l.baseQty).toBe(50);
    expect(l.netQty).toBe(40);
    expect(l.effectiveNetQty).toBe(40);
    expect(l.lossBps).toBe(2000);
  });

  it('treats a missing netto as no loss', () => {
    const l = new RecipeLine({ id: 'l1', branchId: 'b', itemId: 'salt', baseQty: 5 });
    expect(l.netQty).toBeNull();
    expect(l.effectiveNetQty).toBe(5);
    expect(l.lossBps).toBe(0);
  });
});
