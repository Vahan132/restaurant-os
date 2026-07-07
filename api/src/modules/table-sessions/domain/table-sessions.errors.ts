import { DomainError } from '../../../shared/domain/domain-error';
import { TableSessionState } from './enums';

/** Table-sessions domain errors (pure — no framework imports). */

/** An illegal lifecycle transition was attempted. */
export class InvalidTableSessionTransitionError extends DomainError {
  readonly code = 'INVALID_TABLE_SESSION_TRANSITION';
  override readonly httpStatus = 409;
  constructor(from: TableSessionState, to: TableSessionState) {
    super(`Cannot transition a table session from ${from} to ${to}.`);
  }
}

/** A terminal (CLOSED/EXPIRED) session was mutated. */
export class TableSessionTerminalError extends DomainError {
  readonly code = 'TABLE_SESSION_TERMINAL';
  override readonly httpStatus = 409;
  constructor() {
    super('This table session is terminal and can no longer change.');
  }
}

/**
 * The requested (channel, flow) is not permitted by the effective ordering
 * policy (restaurant ceiling AND branch config).
 */
export class OrderingFlowNotPermittedError extends DomainError {
  readonly code = 'ORDERING_FLOW_NOT_PERMITTED';
  override readonly httpStatus = 409;
  constructor(message = 'The requested ordering flow is not permitted for this table.') {
    super(message);
  }
}

/**
 * Raised when the partial unique index rejects a second non-terminal session for
 * a (branch, table) — a create race. The open-or-join use-case catches this and
 * returns the winning session instead.
 */
export class ActiveTableSessionConflictError extends DomainError {
  readonly code = 'ACTIVE_TABLE_SESSION_CONFLICT';
  override readonly httpStatus = 409;
  constructor() {
    super('An active session already exists for this table.');
  }
}
