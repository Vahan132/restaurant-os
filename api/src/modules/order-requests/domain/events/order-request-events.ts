import { BaseDomainEvent } from '../../../../shared/domain/domain-event';

/** Order-requests domain events (namespaced `order_requests.*`). Relayed to POS. */

export class OrderRequestCreatedEvent extends BaseDomainEvent {
  readonly eventName = 'order_requests.request.created';
  constructor(
    public readonly requestId: string,
    public readonly restaurantId: string,
    /** Transient: the request's branch = its table's branch (no schema column). */
    public readonly branchId: string,
    public readonly tableId: string,
    public readonly status: string,
  ) {
    super(requestId);
  }
}

export class OrderRequestConfirmedEvent extends BaseDomainEvent {
  readonly eventName = 'order_requests.request.confirmed';
  constructor(
    public readonly requestId: string,
    public readonly restaurantId: string,
    /** Transient: the request's branch = its table's branch (no schema column). */
    public readonly branchId: string,
    public readonly linkedOrderId: string,
    public readonly status: string,
  ) {
    super(requestId);
  }
}

export class OrderRequestRejectedEvent extends BaseDomainEvent {
  readonly eventName = 'order_requests.request.rejected';
  constructor(
    public readonly requestId: string,
    public readonly restaurantId: string,
    /** Transient: the request's branch = its table's branch (no schema column). */
    public readonly branchId: string,
    public readonly reason: string | null,
    public readonly status: string,
  ) {
    super(requestId);
  }
}
