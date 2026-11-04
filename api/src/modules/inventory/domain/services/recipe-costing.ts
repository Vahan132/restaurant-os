/**
 * COST-FIFO-1: dish cost-price math (pure domain).
 *
 * A dish costs Σ over its recipe lines of BRUTTO qty × the ingredient's current
 * batch unit cost (MICRO precision), each line rounded HALF_UP to minor units.
 * Brutto (not netto) is what leaves stock, so it is what the dish really costs.
 */
import { roundedDiv } from '../value-objects/money';

const MICRO = 1_000_000;

export interface CostedLine {
  itemId: string;
  /** BRUTTO per dish, in the item's base unit. */
  baseQty: number;
}

/** Cost (minor units) of `baseQty` base units at a MICRO unit cost. */
export function lineCostAmount(baseQty: number, unitCostMicro: bigint | null | undefined): number {
  if (!unitCostMicro || unitCostMicro <= 0n || baseQty <= 0) {
    return 0;
  }
  return roundedDiv(baseQty * Number(unitCostMicro), MICRO);
}

/** Dish cost price (minor units) from its lines and a per-item MICRO cost map. */
export function recipeCostAmount(
  lines: ReadonlyArray<CostedLine>,
  unitCostMicroByItem: ReadonlyMap<string, bigint>,
): number {
  return lines.reduce(
    (sum, l) => sum + lineCostAmount(l.baseQty, unitCostMicroByItem.get(l.itemId)),
    0,
  );
}
