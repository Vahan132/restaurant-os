import { BaseDomainEvent } from '../../../../shared/domain/domain-event';

/**
 * Table-session domain events (namespaced `table_sessions.*`). Relayed to the
 * branch room so POS/waiter surfaces see session lifecycle changes. Payloads
 * carry ids + new state only — never the session token.
 */

export class TableSessionOpenedEvent extends BaseDomainEvent {
  readonly eventName = 'table_sessions.session.opened';
  constructor(
    public readonly sessionId: string,
    public readonly restaurantId: string,
    public readonly branchId: string,
    public readonly tableId: string,
    public readonly state: string,
    public readonly flow: string,
    public readonly channel: string,
  ) {
    super(sessionId);
  }
}

export class TableSessionConfirmedEvent extends BaseDomainEvent {
  readonly eventName = 'table_sessions.session.confirmed';
  constructor(
    public readonly sessionId: string,
    public readonly restaurantId: string,
    public readonly branchId: string,
    public readonly tableId: string,
    public readonly state: string,
  ) {
    super(sessionId);
  }
}

export class TableSessionClosedEvent extends BaseDomainEvent {
  readonly eventName = 'table_sessions.session.closed';
  constructor(
    public readonly sessionId: string,
    public readonly restaurantId: string,
    public readonly branchId: string,
    public readonly tableId: string,
    public readonly state: string,
  ) {
    super(sessionId);
  }
}
