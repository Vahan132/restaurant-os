import { DomainError } from '../../../shared/domain/domain-error';

/** Consumer-discovery domain errors (pure — no framework imports). */

/** A branch detail/availability lookup whose target is not effectively listed. */
export class BranchNotListedError extends DomainError {
  readonly code = 'BRANCH_NOT_LISTED';
  override readonly httpStatus = 404;
  constructor() {
    super('This branch is not available in the consumer app.');
  }
}

/** Availability requested for a branch whose reservations are not public. */
export class ReservationsNotPublicError extends DomainError {
  readonly code = 'RESERVATIONS_NOT_PUBLIC';
  override readonly httpStatus = 409;
  constructor() {
    super('Reservations are not public for this branch.');
  }
}

/**
 * `listedInConsumerApp = true` was requested while the brand+branch profile is
 * incomplete. `missing` is a structured list so callers can surface the gaps.
 */
export class RestaurantProfileIncompleteError extends DomainError {
  readonly code = 'RESTAURANT_PROFILE_INCOMPLETE';
  override readonly httpStatus = 409;
  constructor(readonly missing: string[]) {
    super(`Profile is incomplete; missing: ${missing.join(', ')}.`);
  }
}

/** A selected attributeValueId does not reference an existing AttributeValue. */
export class AttributeValueNotFoundError extends DomainError {
  readonly code = 'ATTRIBUTE_VALUE_NOT_FOUND';
  override readonly httpStatus = 400;
  constructor(readonly attributeValueId: string) {
    super(`Unknown attribute value: ${attributeValueId}.`);
  }
}

/**
 * CX-ADMIN: a taxonomy value (or a value under a category) cannot be deleted
 * because at least one restaurant still has it selected. Safe default is to
 * BLOCK the delete rather than silently detach selections.
 */
export class AttributeValueInUseError extends DomainError {
  readonly code = 'ATTRIBUTE_VALUE_IN_USE';
  override readonly httpStatus = 409;
  constructor(readonly attributeValueId: string) {
    super(`Attribute value ${attributeValueId} is in use and cannot be deleted.`);
  }
}

/** CX-ADMIN: a taxonomy category id does not reference an existing category. */
export class AttributeCategoryNotFoundError extends DomainError {
  readonly code = 'ATTRIBUTE_CATEGORY_NOT_FOUND';
  override readonly httpStatus = 404;
  constructor(readonly categoryId: string) {
    super(`Unknown attribute category: ${categoryId}.`);
  }
}

/** A photo url is not a parseable https URL. */
export class InvalidPhotoUrlError extends DomainError {
  readonly code = 'INVALID_PHOTO_URL';
  override readonly httpStatus = 400;
  constructor(readonly url: string) {
    super(`Photo url must be a valid https URL: ${url}.`);
  }
}

/** A public-hours row is malformed (bad HH:mm, or open row missing times). */
export class InvalidPublicHoursError extends DomainError {
  readonly code = 'INVALID_PUBLIC_HOURS';
  override readonly httpStatus = 400;
  constructor(message: string) {
    super(message);
  }
}

/**
 * CX-3: the requested time is no longer (or never was) a bookable slot — closed,
 * past the lead-time, or capacity for the slot is full.
 */
export class SlotUnavailableError extends DomainError {
  readonly code = 'SLOT_UNAVAILABLE';
  override readonly httpStatus = 409;
  constructor() {
    super('That time is no longer available. Please pick another slot.');
  }
}

/** CX-3: a reservation the consumer tried to act on is not theirs (or unknown). */
export class ReservationNotYoursError extends DomainError {
  readonly code = 'RESERVATION_NOT_YOURS';
  override readonly httpStatus = 404;
  constructor() {
    super('Reservation not found.');
  }
}

/** CX-3: self-cancel attempted on a past, completed, or already-cancelled booking. */
export class ReservationNotCancellableError extends DomainError {
  readonly code = 'RESERVATION_NOT_CANCELLABLE';
  override readonly httpStatus = 409;
  constructor() {
    super('This reservation can no longer be cancelled.');
  }
}
