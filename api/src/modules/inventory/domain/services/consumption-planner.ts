import { costFromUnitCostMicro, costOfQtyFromLayer } from '../value-objects/money';

/**
 * FIFO/FEFO consumption planner — the pure core of the consumption service.
 *
 * Given an item's OPEN layers and a requested base quantity, decides how much to
 * draw from each layer (oldest-first) and what each draw costs (§5 rounding).
 * No I/O, no framework: callers (the transactional gateway) feed it a snapshot
 * and persist the returned plan.
 */

/** A snapshot of one OPEN layer with stock left to draw. */
export interface OpenLayerSnapshot {
  layerId: string;
  baseQtyReceived: number;
  baseQtyRemaining: number;
  lineTotalCostAmount: number;
  receivedAt: Date;
  expiryDate: Date | null;
}

/** One layer draw produced by the plan. */
export interface LayerDraw {
  layerId: string;
  /** Positive magnitude drawn from this layer. */
  qty: number;
  /** Positive magnitude costed value of this draw (minor units, §5 HALF_UP). */
  costAmount: number;
  /** Remaining base qty on the layer after this draw. */
  newRemaining: number;
  /** Whether the layer is now fully depleted (remaining 0). */
  depleted: boolean;
}

export interface ConsumptionPlan {
  /** Per-layer draws, oldest-first, in the order they were applied. */
  draws: LayerDraw[];
  /** Total base qty actually drawn from layers (excludes shortfall). */
  drawnQty: number;
  /** Unfulfilled qty after exhausting layers (0 when fully covered). */
  shortfallQty: number;
  /** Costed value of the shortfall (valued at lastUnitCostMicro, or 0). */
  shortfallCostAmount: number;
  /** True when stock was exhausted and on-hand will go negative. */
  wentNegative: boolean;
  /** True when the shortfall could not be costed (no lastUnitCostMicro). */
  uncosted: boolean;
}

/**
 * Order OPEN layers oldest-first:
 *  - trackExpiry (FEFO): earliest expiryDate first, NULLs last; ties -> earliest
 *    receivedAt; final tie-break on layerId for determinism.
 *  - else (FIFO): earliest receivedAt first; final tie-break on layerId.
 */
export function orderLayers(
  layers: ReadonlyArray<OpenLayerSnapshot>,
  trackExpiry: boolean,
): OpenLayerSnapshot[] {
  const copy = [...layers];
  copy.sort((a, b) => {
    if (trackExpiry) {
      const ae = a.expiryDate ? a.expiryDate.getTime() : null;
      const be = b.expiryDate ? b.expiryDate.getTime() : null;
      if (ae !== be) {
        if (ae === null) return 1; // NULLs last
        if (be === null) return -1;
        return ae - be;
      }
    }
    const ar = a.receivedAt.getTime();
    const br = b.receivedAt.getTime();
    if (ar !== br) return ar - br;
    return a.layerId < b.layerId ? -1 : a.layerId > b.layerId ? 1 : 0;
  });
  return copy;
}

/**
 * Plan the consumption of `requestedQty` base units.
 *
 * Draws down OPEN layers oldest-first, splitting across layers as needed. If the
 * layers exhaust with qty still to consume, records a shortfall valued at
 * `lastUnitCostMicro` (or 0, flagged uncosted) — never throws on insufficient
 * stock (warn-don't-block).
 */
export function planConsumption(params: {
  requestedQty: number;
  trackExpiry: boolean;
  lastUnitCostMicro: bigint | null;
  layers: ReadonlyArray<OpenLayerSnapshot>;
}): ConsumptionPlan {
  const ordered = orderLayers(
    params.layers.filter((l) => l.baseQtyRemaining > 0),
    params.trackExpiry,
  );

  const draws: LayerDraw[] = [];
  let remaining = params.requestedQty;
  let drawnQty = 0;

  for (const layer of ordered) {
    if (remaining <= 0) break;
    const take = Math.min(layer.baseQtyRemaining, remaining);
    const costAmount = costOfQtyFromLayer(layer.lineTotalCostAmount, take, layer.baseQtyReceived);
    const newRemaining = layer.baseQtyRemaining - take;
    draws.push({
      layerId: layer.layerId,
      qty: take,
      costAmount,
      newRemaining,
      depleted: newRemaining === 0,
    });
    remaining -= take;
    drawnQty += take;
  }

  const shortfallQty = remaining > 0 ? remaining : 0;
  const hasUnitCost = params.lastUnitCostMicro !== null && params.lastUnitCostMicro > 0n;
  const shortfallCostAmount =
    shortfallQty > 0 && hasUnitCost
      ? costFromUnitCostMicro(params.lastUnitCostMicro as bigint, shortfallQty)
      : 0;

  return {
    draws,
    drawnQty,
    shortfallQty,
    shortfallCostAmount,
    wentNegative: shortfallQty > 0,
    uncosted: shortfallQty > 0 && !hasUnitCost,
  };
}
