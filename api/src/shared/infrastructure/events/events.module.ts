import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DomainEventPublisher } from './domain-event-publisher';

/**
 * Global events module. Registers @nestjs/event-emitter and exposes the
 * DomainEventPublisher used by application services to dispatch domain events
 * after persistence.
 */
@Global()
@Module({
  imports: [EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' })],
  providers: [DomainEventPublisher],
  exports: [DomainEventPublisher],
})
export class EventsModule {}
