/**
 * Permission catalog — the SINGLE SOURCE OF TRUTH for permission keys.
 * Pure domain (no framework imports). Roles validate their permission keys
 * against this catalog; the API exposes it via GET /permissions.
 */
export const PERMISSIONS = {
  DASHBOARD_VIEW: 'DASHBOARD_VIEW',
  MENU_MANAGE: 'MENU_MANAGE',
  TABLE_MANAGE: 'TABLE_MANAGE',
  TABLE_STATUS_UPDATE: 'TABLE_STATUS_UPDATE',
  ORDER_CREATE: 'ORDER_CREATE',
  ORDER_EDIT: 'ORDER_EDIT',
  ORDER_CANCEL: 'ORDER_CANCEL',
  DISCOUNT_APPLY: 'DISCOUNT_APPLY',
  PAYMENT_PROCESS: 'PAYMENT_PROCESS',
  REPORTS_VIEW: 'REPORTS_VIEW',
  AUDIT_VIEW: 'AUDIT_VIEW',
  ACCOUNT_MANAGE: 'ACCOUNT_MANAGE',
  RESERVATION_MANAGE: 'RESERVATION_MANAGE',
  KDS_ACCESS: 'KDS_ACCESS',
  USER_MANAGE: 'USER_MANAGE',
  ROLE_MANAGE: 'ROLE_MANAGE',
  SETTINGS_MANAGE: 'SETTINGS_MANAGE',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** All permission keys as a flat, ordered list. */
export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS);

const PERMISSION_SET = new Set<string>(ALL_PERMISSIONS);

/** Type guard / validity check for a single permission key. */
export function isPermissionKey(key: string): key is PermissionKey {
  return PERMISSION_SET.has(key);
}

/** Return the subset of keys that are NOT in the catalog. */
export function unknownPermissionKeys(keys: readonly string[]): string[] {
  return keys.filter((k) => !PERMISSION_SET.has(k));
}

/**
 * Canonical system role codes and their default permission sets (seeded per org).
 * Also the single source for "which roles are system roles".
 */
export const SYSTEM_ROLE_CODES = [
  'OWNER',
  'MANAGER',
  'WAITER',
  'CASHIER',
  'KITCHEN_STAFF',
  'RECEPTIONIST',
] as const;

export type SystemRoleCode = (typeof SYSTEM_ROLE_CODES)[number];

export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRoleCode, PermissionKey[]> = {
  OWNER: [...ALL_PERMISSIONS],
  // MANAGER: everything except ROLE_MANAGE (keeps TABLE_MANAGE + TABLE_STATUS_UPDATE + AUDIT_VIEW).
  MANAGER: ALL_PERMISSIONS.filter((p) => p !== PERMISSIONS.ROLE_MANAGE),
  // Floor staff: table STATUS changes only (NOT TABLE_MANAGE config).
  WAITER: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_EDIT,
    PERMISSIONS.TABLE_STATUS_UPDATE,
  ],
  CASHIER: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ORDER_EDIT,
    PERMISSIONS.PAYMENT_PROCESS,
    PERMISSIONS.DISCOUNT_APPLY,
    PERMISSIONS.TABLE_STATUS_UPDATE,
  ],
  KITCHEN_STAFF: [PERMISSIONS.KDS_ACCESS],
  RECEPTIONIST: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.RESERVATION_MANAGE,
    PERMISSIONS.TABLE_STATUS_UPDATE,
  ],
};

/** Human-friendly default names for the system roles (used by the seed). */
export const SYSTEM_ROLE_NAMES: Record<SystemRoleCode, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  WAITER: 'Waiter',
  CASHIER: 'Cashier',
  KITCHEN_STAFF: 'Kitchen Staff',
  RECEPTIONIST: 'Receptionist',
};
