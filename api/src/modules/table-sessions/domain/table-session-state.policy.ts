import { TableSessionState } from './enums';

/**
 * Allowed TableSession state transitions. The ONLY legal moves; anything else is
 * rejected with InvalidTableSessionTransitionError. All transitions run through
 * use-cases — never a raw write.
 *
 *   create  -> PENDING_CONFIRM (app pay-at-end) | OPEN (prepayment)
 *   PENDING_CONFIRM -> OPEN (waiter confirm) | EXPIRED
 *   OPEN    -> LOCKED (begin settlement) | CLOSED (staff clear) | EXPIRED
 *   LOCKED  -> CLOSED
 */
export const TABLE_SESSION_TRANSITIONS: Record<TableSessionState, TableSessionState[]> = {
  [TableSessionState.PENDING_CONFIRM]: [TableSessionState.OPEN, TableSessionState.EXPIRED],
  [TableSessionState.OPEN]: [
    TableSessionState.LOCKED,
    TableSessionState.CLOSED,
    TableSessionState.EXPIRED,
  ],
  [TableSessionState.LOCKED]: [TableSessionState.CLOSED],
  [TableSessionState.CLOSED]: [],
  [TableSessionState.EXPIRED]: [],
};

export function isValidTableSessionTransition(
  from: TableSessionState,
  to: TableSessionState,
): boolean {
  return TABLE_SESSION_TRANSITIONS[from]?.includes(to) ?? false;
}
