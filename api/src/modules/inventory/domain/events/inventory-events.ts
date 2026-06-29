import { BaseDomainEvent } from '../../../../shared/domain/domain-event';
import { ItemKind, StockMovementType, WriteOffReason } from '../enums';

/** Inventory domain events (namespaced `inventory.*`). Audit/KDS handlers come later. */

export class InventoryItemCreatedEvent extends BaseDomainEvent {
  readonly eventName = 'inventory.item.created';
  constructor(
    public readonly itemId: string,
    public readonly restaurantId: string,
    public readonly kind: ItemKind,
    public readonly actorUserId: string | null = null,
  ) {
    super(itemId);
  }
}

export class InventoryItemDeletedEvent extends BaseDomainEvent {
  readonly eventName = 'inventory.item.deleted';
  constructor(
    public readonly itemId: string,
    public readonly restaurantId: string,
    public readonly actorUserId: string | null = null,
  ) {
    super(itemId);
  }
}

export class GoodsReceiptCreatedEvent extends BaseDomainEvent {
  readonly eventName = 'inventory.goods_receipt.created';
  constructor(
    public readonly receiptId: string,
    public readonly restaurantId: string,
    public readonly lineCount: number,
    public readonly actorUserId: string | null = null,
  ) {
    super(receiptId);
  }
}

/** Raised after an inbound adjustment creates a layer + ADJUSTMENT_IN movement. */
export class StockAdjustedInEvent extends BaseDomainEvent {
  readonly eventName = 'inventory.stock.adjusted_in';
  constructor(
    public readonly itemId: string,
    public readonly restaurantId: string,
    public readonly baseQty: number,
    public readonly uncosted: boolean,
    public readonly actorUserId: string | null = null,
  ) {
    super(itemId);
  }
}

/** Raised after stock is drawn down (any OUT movement type). */
export class StockConsumedEvent extends BaseDomainEvent {
  readonly eventName = 'inventory.stock.consumed';
  constructor(
    public readonly itemId: string,
    public readonly restaurantId: string,
    public readonly type: StockMovementType,
    public readonly requestedBaseQty: number,
    public readonly wentNegative: boolean,
    public readonly actorUserId: string | null = null,
  ) {
    super(itemId);
  }
}

/** Raised when a process definition is created (INV-2). */
export class ProcessCreatedEvent extends BaseDomainEvent {
  readonly eventName = 'inventory.process.created';
  constructor(
    public readonly processId: string,
    public readonly restaurantId: string,
    public readonly actorUserId: string | null = null,
  ) {
    super(processId);
  }
}

/** Raised when a process definition is deleted (INV-2). */
export class ProcessDeletedEvent extends BaseDomainEvent {
  readonly eventName = 'inventory.process.deleted';
  constructor(
    public readonly processId: string,
    public readonly restaurantId: string,
    public readonly actorUserId: string | null = null,
  ) {
    super(processId);
  }
}

/** One input consumed by a run, for the audit trail (7A §4.4). */
export interface ProcessRunInputDetail {
  itemId: string;
  locationId: string;
  baseQty: number;
  costAmount: number;
}

/** One output produced by a run, for the audit trail (7A §4.4). */
export interface ProcessRunOutputDetail {
  itemId: string;
  locationId: string;
  baseQty: number;
  costAmount: number;
}

/**
 * Raised after a production run completes (INV-2). 7A enriched it with the
 * branch + per-input/per-output costs and locations so the run is fully audited
 * (actor, process, inputs consumed + cost + location, output produced + cost +
 * location, timestamp via the audit row).
 */
export class ProcessRunExecutedEvent extends BaseDomainEvent {
  readonly eventName = 'inventory.process.run_executed';
  constructor(
    public readonly runId: string,
    public readonly restaurantId: string,
    public readonly branchId: string,
    public readonly processId: string,
    public readonly multiplier: number,
    public readonly inputCostAmount: number,
    public readonly processingCostAmount: number,
    public readonly totalCostAmount: number,
    public readonly wentNegative: boolean,
    public readonly inputs: ProcessRunInputDetail[],
    public readonly outputs: ProcessRunOutputDetail[],
    public readonly actorUserId: string | null = null,
  ) {
    super(runId);
  }
}

/** Raised when a recipe is created (INV-3). */
export class RecipeCreatedEvent extends BaseDomainEvent {
  readonly eventName = 'inventory.recipe.created';
  constructor(
    public readonly recipeId: string,
    public readonly restaurantId: string,
    public readonly menuItemId: string,
    public readonly actorUserId: string | null = null,
  ) {
    super(recipeId);
  }
}

/**
 * Raised when consuming an item drove on-hand negative (INV-3). The reports /
 * notifications layer can surface this; it NEVER blocks the originating order.
 */
export class InventoryWentNegativeEvent extends BaseDomainEvent {
  readonly eventName = 'inventory.stock.went_negative';
  constructor(
    public readonly itemId: string,
    public readonly restaurantId: string,
    public readonly refType: string | null,
    public readonly refId: string | null,
    public readonly shortfallBaseQty: number,
  ) {
    super(itemId);
  }
}

/**
 * Raised when on-hand at a location crosses at/below its low-stock threshold
 * while still >= 0 (6A, §5). Fires BEFORE zero. The reports/notifications layer
 * can surface it; a persisted LowStockAlert row is the durable source.
 */
export class LowStockAlertRaisedEvent extends BaseDomainEvent {
  readonly eventName = 'inventory.stock.low_stock_raised';
  constructor(
    public readonly itemId: string,
    public readonly restaurantId: string,
    public readonly branchId: string,
    public readonly locationId: string,
    public readonly thresholdBase: number,
    public readonly onHandBase: number,
  ) {
    super(itemId);
  }
}

/**
 * Raised after a correction adjustment sets the actual counted on-hand for an
 * (item, location) (6A, §6). deltaBaseQty is signed (+ surplus / - shortfall).
 */
export class StockCountAdjustedEvent extends BaseDomainEvent {
  readonly eventName = 'inventory.stock.count_adjusted';
  constructor(
    public readonly itemId: string,
    public readonly restaurantId: string,
    public readonly branchId: string,
    public readonly locationId: string,
    public readonly deltaBaseQty: number,
    public readonly countedBaseQty: number,
    public readonly actorUserId: string | null = null,
  ) {
    super(itemId);
  }
}

/**
 * Raised after a within-branch stock transfer completes (6B). Carries enough for
 * the audit trail (from/to location, quantity, slice count). No COGS.
 */
export class StockTransferredEvent extends BaseDomainEvent {
  readonly eventName = 'inventory.stock.transferred';
  constructor(
    public readonly transferId: string,
    public readonly restaurantId: string,
    public readonly branchId: string,
    public readonly itemId: string,
    public readonly fromLocationId: string,
    public readonly toLocationId: string,
    public readonly baseQty: number,
    public readonly sliceCount: number,
    public readonly actorUserId: string | null = null,
  ) {
    super(transferId);
  }
}

/** Raised when a stock write-off is recorded (INV-4). */
export class WriteOffCreatedEvent extends BaseDomainEvent {
  readonly eventName = 'inventory.write_off.created';
  constructor(
    public readonly writeOffId: string,
    public readonly restaurantId: string,
    public readonly reason: WriteOffReason,
    public readonly totalCostAmount: number,
    public readonly actorUserId: string | null = null,
  ) {
    super(writeOffId);
  }
}

/** Raised when a write-off is voided (its consumption reversed) (INV-4). */
export class WriteOffVoidedEvent extends BaseDomainEvent {
  readonly eventName = 'inventory.write_off.voided';
  constructor(
    public readonly writeOffId: string,
    public readonly restaurantId: string,
    public readonly actorUserId: string | null = null,
  ) {
    super(writeOffId);
  }
}
