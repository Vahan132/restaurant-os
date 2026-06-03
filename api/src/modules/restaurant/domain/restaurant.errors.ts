import { DomainError } from '../../../shared/domain/domain-error';

/** Restaurant domain errors (pure — no framework imports). */

export class InvalidRateError extends DomainError {
  readonly code = 'INVALID_RATE';
  override readonly httpStatus = 400;
  constructor(field: string) {
    super(`${field} must be an integer >= 0 (basis points).`);
  }
}
