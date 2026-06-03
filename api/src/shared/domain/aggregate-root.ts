import { DomainEvent } from './domain-event';
import { Entity } from './entity';

/**
 * Base AggregateRoot. Pure domain — no framework imports.
 *
 * An aggregate root is the entry point to an aggregate and the only place that
 * raises domain events. It collects events as it mutates; the application layer
 * pulls and clears them (via `pullDomainEvents`) once the aggregate is persisted
 * and hands them to the DomainEventPublisher.
 */
export abstract class AggregateRoot<TId = string> extends Entity<TId> {
  private _domainEvents: DomainEvent[] = [];

  protected constructor(id: TId) {
    super(id);
  }

  get domainEvents(): readonly DomainEvent[] {
    return this._domainEvents;
  }

  /** Record an event to be dispatched after persistence. */
  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  /** Discard pending events without dispatching them. */
  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  /** Return pending events and clear the buffer in one step. */
  public pullDomainEvents(): DomainEvent[] {
    const events = this._domainEvents;
    this._domainEvents = [];
    return events;
  }
}
