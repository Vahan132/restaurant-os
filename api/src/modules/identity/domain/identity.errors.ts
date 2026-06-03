import { DomainError } from '../../../shared/domain/domain-error';

/**
 * Identity domain errors (pure — no framework imports).
 * Each carries a stable UPPER_SNAKE `code` and an `httpStatus`; the shared
 * DomainExceptionFilter renders them in the standard error shape.
 */

export class InvalidEmailError extends DomainError {
  readonly code = 'INVALID_EMAIL';
  override readonly httpStatus = 400;
  constructor(value: string) {
    super(`Invalid email address: "${value}".`);
  }
}

export class WeakPasswordError extends DomainError {
  readonly code = 'WEAK_PASSWORD';
  override readonly httpStatus = 400;
  constructor(message = 'Password does not meet the strength requirements.') {
    super(message);
  }
}

export class InvalidPasswordHashError extends DomainError {
  readonly code = 'INVALID_PASSWORD_HASH';
  override readonly httpStatus = 400;
  constructor() {
    super('Password hash must be a non-empty string.');
  }
}

export class UnknownPermissionError extends DomainError {
  readonly code = 'UNKNOWN_PERMISSION';
  override readonly httpStatus = 400;
  constructor(keys: string[]) {
    super(`Unknown permission key(s): ${keys.join(', ')}.`);
  }
}

export class SystemRoleNotDeletableError extends DomainError {
  readonly code = 'SYSTEM_ROLE_NOT_DELETABLE';
  override readonly httpStatus = 409;
  constructor() {
    super('System roles cannot be deleted.');
  }
}

export class UserAlreadyBlockedError extends DomainError {
  readonly code = 'USER_ALREADY_BLOCKED';
  override readonly httpStatus = 409;
  constructor() {
    super('User is already blocked.');
  }
}

export class UserNotBlockedError extends DomainError {
  readonly code = 'USER_NOT_BLOCKED';
  override readonly httpStatus = 409;
  constructor() {
    super('User is not blocked.');
  }
}

export class UserNotActiveError extends DomainError {
  readonly code = 'USER_NOT_ACTIVE';
  override readonly httpStatus = 403;
  constructor() {
    super('User account is blocked or deleted.');
  }
}
