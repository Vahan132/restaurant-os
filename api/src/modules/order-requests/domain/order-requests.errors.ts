import { DomainError } from '../../../shared/domain/domain-error';

/** Order-requests domain errors (pure — no framework imports). */

export class RequestNotPendingError extends DomainError {
  readonly code = 'REQUEST_NOT_PENDING';
  override readonly httpStatus = 409;
  constructor() {
    super('Only a PENDING request can be confirmed or rejected.');
  }
}

export class EmptyRequestError extends DomainError {
  readonly code = 'EMPTY_REQUEST';
  override readonly httpStatus = 400;
  constructor() {
    super('An order request must contain at least one item.');
  }
}
