import { DomainError } from '../../../shared/domain/domain-error';

/** Platform domain errors (pure — no framework imports). */

export class PlatformUserAlreadyBlockedError extends DomainError {
  readonly code = 'PLATFORM_USER_ALREADY_BLOCKED';
  override readonly httpStatus = 409;
  constructor() {
    super('Platform user is already blocked.');
  }
}

export class PlatformUserNotBlockedError extends DomainError {
  readonly code = 'PLATFORM_USER_NOT_BLOCKED';
  override readonly httpStatus = 409;
  constructor() {
    super('Platform user is not blocked.');
  }
}

export class PlatformUserNotActiveError extends DomainError {
  readonly code = 'PLATFORM_USER_NOT_ACTIVE';
  override readonly httpStatus = 403;
  constructor() {
    super('Platform user account is blocked or deleted.');
  }
}

export class PlanLimitExceededError extends DomainError {
  readonly code = 'PLAN_LIMIT_EXCEEDED';
  override readonly httpStatus = 422;
  constructor(message: string) {
    super(message);
  }
}

export class InvalidPriceError extends DomainError {
  readonly code = 'INVALID_PRICE';
  override readonly httpStatus = 400;
  constructor() {
    super('priceAmount must be a non-negative integer (minor units).');
  }
}
