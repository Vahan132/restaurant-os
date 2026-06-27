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

/** Raised after a production run completes (INV-2). */
export class ProcessRunExecutedEvent extends BaseDomainEvent {
  readonly eventName = 'inventory.process.run_executed';
  constructor(
    public readonly runId: string,
    public readonly restaurantId: string,
    public readonly processId: string,
    public readonly totalCostAmount: number,
    public readonly wentNegative: boolean,
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
