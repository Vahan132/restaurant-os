import { DomainError } from '../../../shared/domain/domain-error';

/** Restaurant domain errors (pure — no framework imports). */

export class InvalidRateError extends DomainError {
  readonly code = 'INVALID_RATE';
  override readonly httpStatus = 400;
  constructor(field: string) {
    super(`${field} must be an integer >= 0 (basis points).`);
  }
}

/**
 * A branch OrderingConfig invariant was broken (ordering enabled with no flow,
 * qrOrdering without prepayment, or idle-expiry out of bounds).
 */
export class InvalidOrderingConfigError extends DomainError {
  readonly code = 'INVALID_ORDERING_CONFIG';
  override readonly httpStatus = 400;
  constructor(message: string) {
    super(message);
  }
}
