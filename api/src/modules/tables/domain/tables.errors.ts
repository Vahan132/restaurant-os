import { DomainError } from '../../../shared/domain/domain-error';

/** Tables domain errors (pure — no framework imports). */

export class InvalidTableTransitionError extends DomainError {
  readonly code = 'INVALID_TABLE_TRANSITION';
  override readonly httpStatus = 409;
  constructor(from: string, to: string) {
    super(`Invalid table status transition: ${from} -> ${to}.`);
  }
}

export class FloorHasTablesError extends DomainError {
  readonly code = 'FLOOR_HAS_TABLES';
  override readonly httpStatus = 409;
  constructor() {
    super('Cannot delete a floor that still has tables.');
  }
}

export class TableNotDeletableError extends DomainError {
  readonly code = 'TABLE_NOT_DELETABLE';
  override readonly httpStatus = 409;
  constructor() {
    super('Cannot delete a table that is OCCUPIED or RESERVED.');
  }
}
