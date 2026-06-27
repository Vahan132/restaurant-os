/**
 * Cost-precision helpers (pure domain).
 *
 * Layers store `lineTotalCostAmount` + `baseQtyReceived`; a per-unit cost is
 * NEVER stored rounded. We derive a costed value only at the money boundary.
 *
 * Rounding policy: HALF_UP (round half away from zero). All inputs here are
 * non-negative integers, so half-up == round-half-toward-+infinity. The caller
 * applies the sign (movements store costs signed).
 */

const MICRO = 1_000_000;

/**
 * Half-up division of two non-negative integers, returning an integer.
 * `roundedDiv(7, 2) === 4`, `roundedDiv(5, 2) === 3`.
 */
export function roundedDiv(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  // (2*numerator + denominator) / (2*denominator), floored — exact HALF_UP for
  // non-negative integer operands, with no floating-point rounding drift.
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

/**
 * Cost of consuming `qty` base units from a layer:
 *   round( lineTotalCostAmount * qty / baseQtyReceived )   [HALF_UP]
 * Returns a non-negative integer in minor units.
 */
export function costOfQtyFromLayer(
  lineTotalCostAmount: number,
  qty: number,
  baseQtyReceived: number,
): number {
  return roundedDiv(lineTotalCostAmount * qty, baseQtyReceived);
}

/**
 * Most-recent unit cost at MICRO precision (cost-per-base-unit × 1,000,000),
 * derived from a receipt line: round( lineTotalCostAmount * 1e6 / baseQty ).
 * Stored as BigInt on the item; used ONLY as the negative-stock fallback.
 */
export function unitCostMicroFromLine(lineTotalCostAmount: number, baseQty: number): bigint {
  if (baseQty <= 0) {
    return 0n;
  }
  return BigInt(roundedDiv(lineTotalCostAmount * MICRO, baseQty));
}

/**
 * Costed value of `qty` base units valued at a MICRO unit cost:
 *   round( unitCostMicro * qty / 1e6 )   [HALF_UP]
 * Used to value an inbound adjustment (cost from item.lastUnitCostMicro) and the
 * negative-stock shortfall. Returns a non-negative integer in minor units.
 */
export function costFromUnitCostMicro(unitCostMicro: bigint, qty: number): number {
  if (unitCostMicro <= 0n) {
    return 0;
  }
  // unitCostMicro fits in a regular number for any realistic cost; keep it exact
  // via roundedDiv on Number-converted operands.
  return roundedDiv(Number(unitCostMicro) * qty, MICRO);
}
