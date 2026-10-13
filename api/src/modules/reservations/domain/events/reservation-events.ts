import { BaseDomainEvent } from '../../../../shared/domain/domain-event';

/**
 * Reservations domain events (namespaced `reservations.*`). The realtime relay
 * maps these to a small `reservation.updated` broadcast { reservationId, status }.
 */

abstract class ReservationEvent extends BaseDomainEvent {
  constructor(
    public readonly reservationId: string,
    public readonly restaurantId: string,
    /** Owning branch (sourced from the reservation). Drives the realtime relay's branch room. */
    public readonly branchId: string,
    public readonly status: string,
    public readonly actorUserId: string | null = null,
  ) {
    super(reservationId);
  }
}

export class ReservationCreatedEvent extends ReservationEvent {
  readonly eventName = 'reservations.reservation.created';
}
export class ReservationConfirmedEvent extends ReservationEvent {
  readonly eventName = 'reservations.reservation.confirmed';
}
export class ReservationArrivedEvent extends ReservationEvent {
  readonly eventName = 'reservations.reservation.arrived';
}
export class ReservationSeatedEvent extends ReservationEvent {
  readonly eventName = 'reservations.reservation.seated';
}
export class ReservationCompletedEvent extends ReservationEvent {
  readonly eventName = 'reservations.reservation.completed';
}
export class ReservationCancelledEvent extends ReservationEvent {
  readonly eventName = 'reservations.reservation.cancelled';
}
export class ReservationNoShowEvent extends ReservationEvent {
  readonly eventName = 'reservations.reservation.no_show';
}
