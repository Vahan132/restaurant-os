import { DomainError } from '../../../shared/domain/domain-error';

/** Reservations domain errors (pure — no framework imports). */

export class InvalidReservationTransitionError extends DomainError {
  readonly code = 'INVALID_RESERVATION_TRANSITION';
  override readonly httpStatus = 409;
  constructor(from: string, to: string) {
    super(`Invalid reservation status transition: ${from} -> ${to}.`);
  }
}

export class ReservationNotMutableError extends DomainError {
  readonly code = 'RESERVATION_NOT_MUTABLE';
  override readonly httpStatus = 409;
  constructor(message = 'This reservation is terminal and can no longer be modified.') {
    super(message);
  }
}

export class InvalidGuestCountError extends DomainError {
  readonly code = 'INVALID_GUEST_COUNT';
  override readonly httpStatus = 400;
  constructor() {
    super('guestCount must be an integer >= 1.');
  }
}

export class ReservedAtRequiredError extends DomainError {
  readonly code = 'RESERVED_AT_REQUIRED';
  override readonly httpStatus = 400;
  constructor() {
    super('reservedAt (a valid date/time) is required.');
  }
}
