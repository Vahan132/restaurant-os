import { InvalidCostAllocationError } from '../inventory.errors';
import { roundedDiv } from '../value-objects/money';

/**
 * Cost allocation across a process's outputs (pure domain).
 *
 * Allocation rule:
 *  - single output  -> it absorbs 100%.
 *  - costShareBps set -> ALL outputs must set it and they must sum to 10000;
 *    each gets round(total * bps / 10000) [HALF_UP], rounding remainder folded
 *    into the largest share so the whole cost is fully allocated.
 *  - otherwise -> exactly one isPrimary output absorbs 100%, the rest 0.
 */

export interface OutputAllocationSpec {
  isPrimary: boolean;
  costShareBps: number | null;
}

const TOTAL_BPS = 10000;

/**
 * Validate the allocation shape of a process definition's outputs. Throws
 * InvalidCostAllocationError (VALIDATION_ERROR) on any violation. Assumes at
 * least one output (the use case enforces >= 1 input and >= 1 output).
 */
export function validateAllocation(outputs: ReadonlyArray<OutputAllocationSpec>): void {
  if (outputs.length <= 1) {
    return; // single output implicitly absorbs 100%
  }
  const withBps = outputs.filter((o) => o.costShareBps !== null && o.costShareBps !== undefined);
  if (withBps.length > 0) {
    if (withBps.length !== outputs.length) {
      throw new InvalidCostAllocationError(
        'When any output sets costShareBps, all outputs must set it.',
      );
    }
    for (const o of outputs) {
      const bps = o.costShareBps as number;
      if (!Number.isInteger(bps) || bps < 0 || bps > TOTAL_BPS) {
        throw new InvalidCostAllocationError('costShareBps must be an integer in 0..10000.');
      }
    }
    const sum = outputs.reduce((s, o) => s + (o.costShareBps as number), 0);
    if (sum !== TOTAL_BPS) {
      throw new InvalidCostAllocationError(`costShareBps must sum to 10000 (got ${sum}).`);
    }
    return;
  }
  const primaries = outputs.filter((o) => o.isPrimary);
  if (primaries.length !== 1) {
    throw new InvalidCostAllocationError(
      'With multiple outputs and no costShareBps, exactly one output must be isPrimary.',
    );
  }
}

/**
 * Allocate `totalCost` (non-negative minor units) across outputs, in declaration
 * order. Returns an integer amount per output that sums exactly to totalCost.
 */
export function allocateCost(
  totalCost: number,
  outputs: ReadonlyArray<OutputAllocationSpec>,
): number[] {
  const n = outputs.length;
  if (n === 0) {
    return [];
  }
  if (n === 1) {
    return [totalCost];
  }

  const hasBps = outputs.some((o) => o.costShareBps !== null && o.costShareBps !== undefined);
  if (hasBps) {
    const shares = outputs.map((o) => roundedDiv(totalCost * (o.costShareBps ?? 0), TOTAL_BPS));
    const allocated = shares.reduce((s, v) => s + v, 0);
    const remainder = totalCost - allocated;
    if (remainder !== 0) {
      // Fold the rounding remainder into the largest-share output (deterministic).
      let idx = 0;
      for (let i = 1; i < outputs.length; i++) {
        if ((outputs[i].costShareBps ?? 0) > (outputs[idx].costShareBps ?? 0)) {
          idx = i;
        }
      }
      shares[idx] += remainder;
    }
    return shares;
  }

  // Primary absorbs everything; others zero.
  return outputs.map((o) => (o.isPrimary ? totalCost : 0));
}
