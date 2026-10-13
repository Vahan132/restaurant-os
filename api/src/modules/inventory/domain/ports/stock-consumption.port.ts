import { StockMovementType } from '../enums';

export const STOCK_CONSUMPTION_PORT = Symbol('StockConsumptionPort');

/**
 * Command to draw stock down from an item's layers (FIFO/FEFO).
 *
 * `type` is the OUT movement kind to record (ADJUSTMENT_OUT for manual counts,
 * CONSUMPTION_OUT for order/recipe callers, WRITE_OFF_OUT for write-offs). The
 * optional `refType`/`refId` link the movement to the originating record so
 * later reversals can be precise.
 */
export interface ConsumeStockCommand {
  restaurantId: string;
  itemId: string;
  /** Positive integer base-unit quantity to consume. */
  baseQty: number;
  type: StockMovementType;
  reason?: string | null;
  refType?: string | null;
  refId?: string | null;
  createdByUserId: string;
  /** Defaults to now() if omitted. */
  occurredAt?: Date;
  /**
   * 6C: location to deplete from. When omitted, the implementation resolves the
   * item's consumption location (per-item default for that branch). Callers that
   * need a specific shelf may pin it here.
   */
  locationId?: string | null;
}

export interface StockConsumptionResult {
  itemId: string;
  requestedBaseQty: number;
  /** Qty actually drawn from OPEN layers (excludes shortfall). */
  consumedFromLayers: number;
  /** Number of distinct layers drawn from. */
  layersDrawn: number;
  /** Unfulfilled qty after layers exhausted (0 when fully covered). */
  shortfallBaseQty: number;
  /** True when stock exhausted and on-hand went negative. NEVER throws. */
  wentNegative: boolean;
  /** True when the shortfall could not be costed (no lastUnitCostMicro). */
  uncosted: boolean;
  /** Total costed value of this consumption (positive magnitude, minor units). */
  totalCostAmount: number;
}

/** Command to reverse a prior consumption identified by its (refType, refId). */
export interface ReverseStockCommand {
  restaurantId: string;
  refType: string;
  refId: string;
  createdByUserId: string;
  occurredAt?: Date;
}

export interface StockReversalResult {
  /** Number of original OUT movements that were reversed (0 = nothing to do). */
  reversedCount: number;
}

/**
 * StockConsumptionPort — the reusable FIFO/FEFO consumption contract.
 *
 * Later bounded contexts (orders/recipes, processes/write-offs) depend on THIS
 * port, never on the concrete InventoryConsumptionService. Implementations must
 * be transactional and must NEVER throw on insufficient stock (warn-don't-block).
 *
 * `consume` is idempotent per (refType, refId, itemId): a second call for an
 * already-consumed ref/item is a no-op (prevents double-deduct on re-fire).
 * `reverse` restores layers + emits CONSUMPTION_REVERSAL movements and is a
 * no-op if the ref was already reversed.
 */
export interface StockConsumptionPort {
  consume(command: ConsumeStockCommand): Promise<StockConsumptionResult>;
  reverse(command: ReverseStockCommand): Promise<StockReversalResult>;
}
