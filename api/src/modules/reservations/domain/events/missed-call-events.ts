import { BaseDomainEvent } from '../../../../shared/domain/domain-event';

/**
 * Missed-call domain events (namespaced `reservations.missed_call.*`). The
 * realtime relay maps the created event to a `missedcall.new` restaurant
 * broadcast so the inbox updates live.
 */
export class MissedCallCreatedEvent extends BaseDomainEvent {
  readonly eventName = 'reservations.missed_call.created';
  constructor(
    public readonly missedCallId: string,
    public readonly restaurantId: string,
    /** Owning branch (the recording device's branch). Drives the relay's branch room. */
    public readonly branchId: string,
    public readonly phoneNumber: string,
    /** When the call was missed (distinct from the event's own occurredAt). */
    public readonly callOccurredAt: Date,
  ) {
    super(missedCallId);
  }
}
