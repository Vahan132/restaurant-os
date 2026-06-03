/**
 * Domain event contract. Pure domain — no framework imports.
 *
 * Aggregates raise events as their state changes; the application layer
 * dispatches them (via DomainEventPublisher) after the aggregate is persisted.
 */
export interface DomainEvent {
  /** Stable, UPPER_SNAKE-ish identifier, e.g. "restaurant.created". */
  readonly eventName: string;
  /** When the event occurred. */
  readonly occurredAt: Date;
  /** Id of the aggregate that raised the event. */
  readonly aggregateId: string;
}

/**
 * Convenience base class for domain events. Implementations set `eventName`
 * and may add their own payload fields.
 */
export abstract class BaseDomainEvent implements DomainEvent {
  public abstract readonly eventName: string;
  public readonly occurredAt: Date;
  public readonly aggregateId: string;

  protected constructor(aggregateId: string, occurredAt: Date = new Date()) {
    this.aggregateId = aggregateId;
    this.occurredAt = occurredAt;
  }
}
