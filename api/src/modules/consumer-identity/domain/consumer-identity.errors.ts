import { DomainError } from '../../../shared/domain/domain-error';

/**
 * Consumer-identity domain errors (pure). Mapped to the standard error envelope by
 * the shared DomainExceptionFilter via `code` (UPPER_SNAKE) + `httpStatus`.
 * No central registry — each module owns its codes (per project convention).
 */

export class ProviderTokenInvalidError extends DomainError {
  readonly code = 'PROVIDER_TOKEN_INVALID';
  override readonly httpStatus = 401;
  constructor(message = 'The provider ID token is invalid or could not be verified.') {
    super(message);
  }
}

export class OtpRequestRateLimitedError extends DomainError {
  readonly code = 'OTP_REQUEST_RATE_LIMITED';
  override readonly httpStatus = 429;
  constructor(message = 'Too many OTP requests. Try again later.') {
    super(message);
  }
}

export class OtpInvalidOrExpiredError extends DomainError {
  readonly code = 'OTP_INVALID_OR_EXPIRED';
  override readonly httpStatus = 400;
  constructor(message = 'The code is incorrect or has expired.') {
    super(message);
  }
}

export class OtpLockedOutError extends DomainError {
  readonly code = 'OTP_LOCKED_OUT';
  override readonly httpStatus = 429;
  constructor(message = 'Too many incorrect attempts. Try again later.') {
    super(message);
  }
}

export class RefreshTokenInvalidError extends DomainError {
  readonly code = 'REFRESH_TOKEN_INVALID';
  override readonly httpStatus = 401;
  constructor(message = 'The refresh token is invalid or expired.') {
    super(message);
  }
}

export class RefreshTokenReusedError extends DomainError {
  readonly code = 'REFRESH_TOKEN_REUSED';
  override readonly httpStatus = 401;
  constructor(message = 'Refresh token reuse detected; the session family was revoked.') {
    super(message);
  }
}

export class EmailImmutableError extends DomainError {
  readonly code = 'EMAIL_IMMUTABLE';
  override readonly httpStatus = 400;
  constructor(message = 'Email is provider-owned and cannot be changed.') {
    super(message);
  }
}

export class PhoneAlreadyInUseError extends DomainError {
  readonly code = 'PHONE_ALREADY_IN_USE';
  override readonly httpStatus = 409;
  constructor(message = 'That phone number already belongs to another account.') {
    super(message);
  }
}

export class ConsumerUnauthenticatedError extends DomainError {
  readonly code = 'CONSUMER_UNAUTHENTICATED';
  override readonly httpStatus = 401;
  constructor(message = 'Consumer authentication is required.') {
    super(message);
  }
}

export class InvalidPhoneNumberError extends DomainError {
  readonly code = 'INVALID_PHONE_NUMBER';
  override readonly httpStatus = 400;
  constructor(message = 'Phone number must be a valid E.164 number.') {
    super(message);
  }
}

export class ConsumerAccountNotFoundError extends DomainError {
  readonly code = 'CONSUMER_ACCOUNT_NOT_FOUND';
  override readonly httpStatus = 404;
  constructor(message = 'Consumer account not found.') {
    super(message);
  }
}
