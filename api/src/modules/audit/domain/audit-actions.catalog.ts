/**
 * Audit action catalog — the SINGLE SOURCE OF TRUTH for the action codes the
 * system records (see AuditEventSubscribers). Pure domain (no framework imports).
 *
 * The filtered activity-log view validates the `action` filter against this set
 * so callers cannot query by an action that is never recorded. Keep in sync when
 * a new audited domain event is mapped in the subscribers.
 */
export const AUDIT_ACTIONS = [
  // identity
  'USER_LOGGED_IN',
  'USER_CREATED',
  'USER_BLOCKED',
  'USER_UNBLOCKED',
  // menu
  'MENU_ITEM_CREATED',
  'MENU_ITEM_PRICE_CHANGED',
  'MENU_ITEM_DELETED',
  // orders
  'ORDER_CANCELLED',
  'ORDER_ITEM_CANCELLED',
  'DISCOUNT_APPLIED',
  // manager step-up discounts (4A)
  'DISCOUNT_STEP_UP_AUTHORIZED',
  'DISCOUNT_STEP_UP_FAILED',
  'PAYMENT_RECORDED',
  'ORDER_CLOSED',
  // reservations
  'RESERVATION_CANCELLED',
  'RESERVATION_NO_SHOW',
  // platform
  'ORGANIZATION_PROVISIONED',
  'ORGANIZATION_SUSPENDED',
  'SUBSCRIPTION_STATUS_CHANGED',
  // device-anchored staff auth (3A)
  'DEVICE_ENROLLED',
  'DEVICE_REVOKED',
  'STAFF_PIN_CREATED',
  'STAFF_PIN_RESET',
  'STAFF_PIN_REVOKED',
  'STAFF_PIN_LOCKED_OUT',
  'BRANCH_IP_POLICY_CHANGED',
  'ADMIN_LOGIN_POLICY_CHANGED',
  // multi-location inventory (6A): correction adjustments (counted on-hand)
  'INVENTORY_COUNT_ADJUSTED',
  // multi-location inventory (6B): within-branch stock transfers
  'INVENTORY_TRANSFERRED',
  // KDS prep/production (7A): a process production run was executed
  'INVENTORY_PROCESS_RUN',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

const AUDIT_ACTION_SET = new Set<string>(AUDIT_ACTIONS);

/** Type guard: is `value` a known, recorded audit action code? */
export function isKnownAuditAction(value: string): value is AuditAction {
  return AUDIT_ACTION_SET.has(value);
}
