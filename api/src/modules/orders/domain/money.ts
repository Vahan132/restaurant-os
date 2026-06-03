import { DiscountType } from './enums';

/**
 * Integer money math — minor units only, NO floats, NO tax. Half-up rounding
 * implemented via integer arithmetic.
 */

/** round(amount * bps / 10000) using half-up rounding (amounts are non-negative). */
export function applyBpsHalfUp(amount: number, bps: number): number {
  return Math.floor((amount * bps + 5000) / 10000);
}

/** discountAmount per spec: PERCENT -> bps of subtotal (capped); FIXED -> min(value, subtotal). */
export function computeDiscountAmount(
  subtotal: number,
  discountType: DiscountType | null,
  discountValue: number | null,
): number {
  if (discountType === null || discountValue === null) {
    return 0;
  }
  if (discountType === DiscountType.PERCENT) {
    return Math.min(applyBpsHalfUp(subtotal, discountValue), subtotal);
  }
  // FIXED
  return Math.min(discountValue, subtotal);
}

export interface OrderTotals {
  subtotalAmount: number;
  discountAmount: number;
  serviceFeeAmount: number;
  totalAmount: number;
}

/**
 * Total = subtotal - discount + serviceFee. serviceFee is computed on the
 * discounted subtotal. NO tax anywhere.
 */
export function computeTotals(
  subtotal: number,
  discountType: DiscountType | null,
  discountValue: number | null,
  serviceFeeRateBps: number,
): OrderTotals {
  const discountAmount = computeDiscountAmount(subtotal, discountType, discountValue);
  const discountedSubtotal = subtotal - discountAmount;
  const serviceFeeAmount = applyBpsHalfUp(discountedSubtotal, serviceFeeRateBps);
  const totalAmount = discountedSubtotal + serviceFeeAmount;
  return { subtotalAmount: subtotal, discountAmount, serviceFeeAmount, totalAmount };
}

/**
 * Split `total` into `parts` integer shares that SUM EXACTLY to `total`.
 * The remainder (total mod parts) is distributed one unit at a time to the
 * first shares, so shares differ by at most 1. NO floats. `parts` must be >= 1.
 */
export function splitEvenShares(total: number, parts: number): number[] {
  if (!Number.isInteger(parts) || parts < 1) {
    throw new Error('parts must be an integer >= 1');
  }
  const base = Math.floor(total / parts);
  const remainder = total - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}
