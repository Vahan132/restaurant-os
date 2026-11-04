import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import {
  isTerminalTableSessionState,
  TableSessionChannel,
  TableSessionFlow,
  TableSessionState,
} from '../enums';
import {
  TableSessionClosedEvent,
  TableSessionConfirmedEvent,
  TableSessionOpenedEvent,
} from '../events/table-session-events';
import {
  InvalidTableSessionTransitionError,
  TableSessionTerminalError,
} from '../table-sessions.errors';
import { isValidTableSessionTransition } from '../table-session-state.policy';

export interface TableSessionProps {
  restaurantId: string;
  branchId: string;
  tableId: string;
  state: TableSessionState;
  flow: TableSessionFlow;
  channel: TableSessionChannel;
  /** SHA-256 of the opaque server-issued token; the plaintext is never stored. */
  tokenHash: string;
  /** App participant who opened the session (null for anonymous QR-web). */
  consumerAccountId: string | null;
  openedAt: Date;
  lastActivityAt: Date;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTableSessionInput {
  id: string;
  restaurantId: string;
  branchId: string;
  tableId: string;
  flow: TableSessionFlow;
  channel: TableSessionChannel;
  /** Initial state, decided by the ordering-flow policy (OPEN | PENDING_CONFIRM). */
  initialState: TableSessionState;
  tokenHash: string;
  consumerAccountId?: string | null;
}

/**
 * TableSession aggregate root — the ordering CONTAINER for a (branch, table).
 *
 * Invariants enforced here:
 *   - transitions are limited to TABLE_SESSION_TRANSITIONS (named error otherwise);
 *   - terminal states (CLOSED/EXPIRED) are immutable;
 *   - every write touches lastActivityAt.
 *
 * The "at most one non-terminal session per (branch, table)" invariant is
 * enforced by the use-case guard + a partial unique index (it spans rows, so it
 * cannot live inside a single aggregate).
 */
export class TableSession extends AggregateRoot<string> {
  private props: TableSessionProps;

  private constructor(id: string, props: TableSessionProps) {
    super(id);
    this.props = props;
  }

  static create(input: CreateTableSessionInput): TableSession {
    const now = new Date();
    const session = new TableSession(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      tableId: input.tableId,
      state: input.initialState,
      flow: input.flow,
      channel: input.channel,
      tokenHash: input.tokenHash,
      consumerAccountId: input.consumerAccountId ?? null,
      openedAt: now,
      lastActivityAt: now,
      closedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    session.addDomainEvent(
      new TableSessionOpenedEvent(
        session.id,
        input.restaurantId,
        input.branchId,
        input.tableId,
        input.initialState,
        input.flow,
        input.channel,
      ),
    );
    return session;
  }

  static reconstitute(id: string, props: TableSessionProps): TableSession {
    return new TableSession(id, props);
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get tableId(): string {
    return this.props.tableId;
  }
  get state(): TableSessionState {
    return this.props.state;
  }
  get flow(): TableSessionFlow {
    return this.props.flow;
  }
  get channel(): TableSessionChannel {
    return this.props.channel;
  }
  get tokenHash(): string {
    return this.props.tokenHash;
  }
  get consumerAccountId(): string | null {
    return this.props.consumerAccountId;
  }
  get openedAt(): Date {
    return this.props.openedAt;
  }
  get lastActivityAt(): Date {
    return this.props.lastActivityAt;
  }
  get closedAt(): Date | null {
    return this.props.closedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isTerminal(): boolean {
    return isTerminalTableSessionState(this.props.state);
  }

  /** Bump activity + updatedAt. Every write use-case calls this (directly or via a transition). */
  touchActivity(now: Date = new Date()): void {
    if (this.isTerminal()) {
      throw new TableSessionTerminalError();
    }
    this.props.lastActivityAt = now;
    this.props.updatedAt = now;
  }

  private transitionTo(target: TableSessionState, now: Date): void {
    if (!isValidTableSessionTransition(this.props.state, target)) {
      throw new InvalidTableSessionTransitionError(this.props.state, target);
    }
    this.props.state = target;
    this.props.lastActivityAt = now;
    this.props.updatedAt = now;
  }

  /** Waiter confirm: PENDING_CONFIRM -> OPEN (the confirm-once binding). */
  confirm(now: Date = new Date()): void {
    this.transitionTo(TableSessionState.OPEN, now);
    this.addDomainEvent(
      new TableSessionConfirmedEvent(
        this.id,
        this.props.restaurantId,
        this.props.branchId,
        this.props.tableId,
        this.props.state,
      ),
    );
  }

  /** Begin settlement (pay-at-end): OPEN -> LOCKED. No new attachments after this. */
  lock(now: Date = new Date()): void {
    this.transitionTo(TableSessionState.LOCKED, now);
  }

  /** Staff clear / settled: OPEN|LOCKED -> CLOSED. Invalidates tokens (hash cleared). */
  close(now: Date = new Date()): void {
    this.transitionTo(TableSessionState.CLOSED, now);
    this.props.closedAt = now;
    this.props.tokenHash = '';
    this.raiseClosed();
  }

  /** Idle sweep: PENDING_CONFIRM|OPEN -> EXPIRED. Invalidates tokens (hash cleared). */
  expire(now: Date = new Date()): void {
    this.transitionTo(TableSessionState.EXPIRED, now);
    this.props.closedAt = now;
    this.props.tokenHash = '';
    this.raiseClosed();
  }

  /** CLOSED and EXPIRED share the same terminal fan-out (state distinguishes them). */
  private raiseClosed(): void {
    this.addDomainEvent(
      new TableSessionClosedEvent(
        this.id,
        this.props.restaurantId,
        this.props.branchId,
        this.props.tableId,
        this.props.state,
      ),
    );
  }
}
