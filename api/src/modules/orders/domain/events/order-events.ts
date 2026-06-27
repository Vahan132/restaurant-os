import { BaseDomainEvent } from '../../../../shared/domain/domain-event';

/** Orders domain events (namespaced `orders.*`). KDS + audit consume later. */

export class OrderCreatedEvent extends BaseDomainEvent {
  readonly eventName = 'orders.order.created';
  constructor(
    public readonly orderId: string,
    public readonly restaurantId: string,
    public readonly branchId: string,
    public readonly orderNumber: number,
    public readonly tableId: string | null,
  ) {
    super(orderId);
  }
}

export interface SentItemInfo {
  orderItemId: string;
  menuItemId: string;
  nameSnapshot: string;
  preparationStation: string;
  quantity: number;
  /** Selected modifier option ids (drives modifier-consumption in inventory, INV-3). */
  modifierOptionIds: string[];
}

export class OrderItemsSentToKitchenEvent extends BaseDomainEvent {
  readonly eventName = 'orders.order.items_sent_to_kitchen';
  constructor(
    public readonly orderId: string,
    public readonly restaurantId: string,
    public readonly branchId: string,
    public readonly items: SentItemInfo[],
  ) {
    super(orderId);
  }
}

export class OrderItemCancelledEvent extends BaseDomainEvent {
  readonly eventName = 'orders.order.item_cancelled';
  constructor(
    public readonly orderId: string,
    public readonly restaurantId: string,
    public readonly branchId: string,
    public readonly orderItemId: string,
    public readonly preparationStation: string,
    public readonly reason: string,
    public readonly actorUserId: string | null = null,
  ) {
    super(orderId);
  }
}

export class OrderCancelledEvent extends BaseDomainEvent {
  readonly eventName = 'orders.order.cancelled';
  constructor(
    public readonly orderId: string,
    public readonly restaurantId: string,
    public readonly branchId: string,
    public readonly reason: string,
    public readonly actorUserId: string | null = null,
    /** Order item ids that were live on a station when cancelled (INV-3: reverse
     *  their inventory consumption). Empty when nothing had been sent. */
    public readonly sentOrderItemIds: string[] = [],
  ) {
    super(orderId);
  }
}

export class DiscountAppliedEvent extends BaseDomainEvent {
  readonly eventName = 'orders.order.discount_applied';
  constructor(
    public readonly orderId: string,
    public readonly restaurantId: string,
    public readonly discountAmount: number,
    public readonly actorUserId: string | null = null,
  ) {
    super(orderId);
  }
}

export class OrderServedEvent extends BaseDomainEvent {
  readonly eventName = 'orders.order.served';
  constructor(
    public readonly orderId: string,
    public readonly restaurantId: string,
  ) {
    super(orderId);
  }
}

export class PaymentRecordedEvent extends BaseDomainEvent {
  readonly eventName = 'orders.payment.recorded';
  constructor(
    public readonly orderId: string,
    public readonly restaurantId: string,
    public readonly paymentId: string,
    public readonly amount: number,
    public readonly paymentStatus: string,
    public readonly actorUserId: string | null = null,
  ) {
    super(orderId);
  }
}

export class PaymentVoidedEvent extends BaseDomainEvent {
  readonly eventName = 'orders.payment.voided';
  constructor(
    public readonly orderId: string,
    public readonly restaurantId: string,
    public readonly paymentId: string,
    public readonly reason: string | null,
  ) {
    super(orderId);
  }
}

export class OrderClosedEvent extends BaseDomainEvent {
  readonly eventName = 'orders.order.closed';
  constructor(
    public readonly orderId: string,
    public readonly restaurantId: string,
    public readonly branchId: string,
    public readonly tableId: string | null,
    public readonly actorUserId: string | null = null,
  ) {
    super(orderId);
  }
}

export class OrderSplitEvent extends BaseDomainEvent {
  readonly eventName = 'orders.order.split';
  constructor(
    public readonly orderId: string,
    public readonly restaurantId: string,
    public readonly newOrderId: string,
    public readonly movedItemIds: string[],
  ) {
    super(orderId);
  }
}

/** A single KDS item transition (SENT -> PREPARING -> READY). */
export class OrderItemStatusChangedEvent extends BaseDomainEvent {
  readonly eventName = 'orders.order.item_status_changed';
  constructor(
    public readonly orderId: string,
    public readonly restaurantId: string,
    public readonly branchId: string,
    public readonly orderItemId: string,
    public readonly preparationStation: string,
    public readonly itemStatus: string,
    public readonly orderStatus: string,
  ) {
    super(orderId);
  }
}

/** Raised when an order becomes READY (all sent, non-cancelled items are READY). */
export class OrderReadyEvent extends BaseDomainEvent {
  readonly eventName = 'orders.order.ready';
  constructor(
    public readonly orderId: string,
    public readonly restaurantId: string,
    public readonly branchId: string,
    public readonly tableId: string | null,
  ) {
    super(orderId);
  }
}
