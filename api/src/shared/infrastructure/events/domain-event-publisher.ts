import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AggregateRoot } from '../../domain/aggregate-root';
import { DomainEvent } from '../../domain/domain-event';

/**
 * DomainEventPublisher — dispatches domain events over @nestjs/event-emitter.
 *
 * Usage from an application service, AFTER the aggregate has been persisted:
 *
 *   await repo.save(aggregate);
 *   await this.publisher.publishFromAggregate(aggregate);
 *
 * Listeners subscribe with @OnEvent('<event.name>') (e.g. audit log, KDS).
 */
@Injectable()
export class DomainEventPublisher {
  private readonly logger = new Logger(DomainEventPublisher.name);

  constructor(private readonly emitter: EventEmitter2) {}

  /** Publish a single domain event. */
  async publish(event: DomainEvent): Promise<void> {
    this.logger.debug(`Publishing ${event.eventName} (${event.aggregateId})`);
    await this.emitter.emitAsync(event.eventName, event);
  }

  /** Publish many domain events in order. */
  async publishAll(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  /** Pull events off an aggregate (clearing them) and publish them. */
  async publishFromAggregate(aggregate: AggregateRoot<unknown>): Promise<void> {
    const events = aggregate.pullDomainEvents();
    await this.publishAll(events);
  }
}
