/**
 * Table-sessions domain enums (mirror the Prisma enums). Pure domain — no
 * framework imports.
 */

/** Lifecycle state of a TableSession. */
export enum TableSessionState {
  /** App-initiated pay-at-end session awaiting waiter confirmation. */
  PENDING_CONFIRM = 'PENDING_CONFIRM',
  /** Active session; orders may attach. */
  OPEN = 'OPEN',
  /** Settlement in progress (pay-at-end). No new attachments. */
  LOCKED = 'LOCKED',
  /** Terminal — settled or staff-cleared. All participant tokens dead. */
  CLOSED = 'CLOSED',
  /** Terminal — closed by the idle sweep. */
  EXPIRED = 'EXPIRED',
}

/** Which ordering flow the session runs under. */
export enum TableSessionFlow {
  PREPAYMENT = 'PREPAYMENT',
  PAY_AT_END = 'PAY_AT_END',
}

/** Origin channel of the session. */
export enum TableSessionChannel {
  QR_WEB = 'QR_WEB',
  APP = 'APP',
}

/** Non-terminal states — at most one such session may exist per (branch, table). */
export const NON_TERMINAL_TABLE_SESSION_STATES: readonly TableSessionState[] = [
  TableSessionState.PENDING_CONFIRM,
  TableSessionState.OPEN,
  TableSessionState.LOCKED,
];

/** Terminal states — immutable once reached. */
export const TERMINAL_TABLE_SESSION_STATES: readonly TableSessionState[] = [
  TableSessionState.CLOSED,
  TableSessionState.EXPIRED,
];

export function isTerminalTableSessionState(state: TableSessionState): boolean {
  return TERMINAL_TABLE_SESSION_STATES.includes(state);
}

export function isNonTerminalTableSessionState(state: TableSessionState): boolean {
  return NON_TERMINAL_TABLE_SESSION_STATES.includes(state);
}
