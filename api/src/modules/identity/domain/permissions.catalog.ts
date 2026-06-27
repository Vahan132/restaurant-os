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
  // Branch management (BR-1): create/rename/disable/make-default branches and
  // manage branch memberships. Restaurant-scoped (checked against the restaurant-
  // wide role snapshot, NOT branch-resolved). Granted to OWNER/MANAGER (ALL).
  BRANCH_MANAGE: 'BRANCH_MANAGE',
  // Inventory / warehouse (INV-1). Reads require INVENTORY_READ; writes are gated
  // per action. Granted to OWNER/MANAGER automatically (they hold ALL_PERMISSIONS).
  INVENTORY_READ: 'inventory:read',
  INVENTORY_ITEM_MANAGE: 'inventory:item:manage',
  INVENTORY_RECEIPT_CREATE: 'inventory:receipt:create',
  INVENTORY_ADJUSTMENT_CREATE: 'inventory:adjustment:create',
  // Inventory processes / production (INV-2).
  INVENTORY_PROCESS_MANAGE: 'inventory:process:manage',
  INVENTORY_PROCESS_RUN: 'inventory:process:run',
  // Inventory recipes / BOM (INV-3).
  INVENTORY_RECIPE_MANAGE: 'inventory:recipe:manage',
  // Menu sell-price, distinct from MENU_MANAGE so a chef can build items + attach
  // recipes WITHOUT being able to set price (INV-3 §7).
  MENU_ITEM_SET_PRICE: 'menu:item:set_price',
  // Inventory write-offs (INV-4).
  INVENTORY_WRITEOFF_CREATE: 'inventory:writeoff:create',
  INVENTORY_WRITEOFF_VOID: 'inventory:writeoff:void',
  // Edge nodes (OFF-2): register/list/revoke on-prem edge hubs. Restaurant-wide
  // (checked against the JWT permission snapshot, NOT branch-resolved). Granted
  // to OWNER/MANAGER automatically (they hold ALL_PERMISSIONS); existing roles
  // are backfilled by the OFF-2 migration.
  EDGE_MANAGE: 'EDGE_MANAGE',
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
  // BR-1 sentinel. A user assigned this role has NO restaurant-wide access; their
  // access is granted ONLY through BranchMemberships (a role per branch). This is
  // how an admin marks a user "branch-scoped" while keeping User.roleId non-null.
  'BRANCH_SCOPED',
] as const;

export type SystemRoleCode = (typeof SYSTEM_ROLE_CODES)[number];

/**
 * The sentinel role code that denotes a BRANCH-SCOPED user (no restaurant-wide
 * access). Every other role is RESTAURANT-WIDE: its permissions apply at every
 * branch (= "all-branch"). See EffectiveBranchAccessService / BranchAccessGuard.
 */
export const BRANCH_SCOPED_ROLE_CODE: SystemRoleCode = 'BRANCH_SCOPED';

/**
 * True if a role grants RESTAURANT-WIDE (all-branch) access. Per BR-1, the only
 * role that does NOT is the BRANCH_SCOPED sentinel.
 */
export function isRestaurantWideRole(code: string | null | undefined): boolean {
  return !!code && code !== BRANCH_SCOPED_ROLE_CODE;
}

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
  // Sentinel: intentionally EMPTY. A branch-scoped user's permissions come
  // entirely from their BranchMembership role(s), resolved per active branch.
  BRANCH_SCOPED: [],
};

/**
 * ALL-BRANCH reach per system role (FIX-E). This is a SEPARATE dimension from
 * restaurant-wide PERMISSIONS: a role can hold restaurant-wide permissions yet
 * still be branch-explicit. Only the OWNER role reaches every branch by default;
 * a user with an all-branch role sees/operates all active branches without a
 * per-branch BranchMembership. Custom roles default to false.
 */
export const SYSTEM_ROLE_ALL_BRANCHES: Record<SystemRoleCode, boolean> = {
  OWNER: true,
  MANAGER: false,
  WAITER: false,
  CASHIER: false,
  KITCHEN_STAFF: false,
  RECEPTIONIST: false,
  BRANCH_SCOPED: false,
};

/** True if a role grants ALL-BRANCH reach (FIX-E). Null-safe. */
export function hasAllBranches(role: { allBranches?: boolean } | null | undefined): boolean {
  return role?.allBranches === true;
}

/** Human-friendly default names for the system roles (used by the seed). */
export const SYSTEM_ROLE_NAMES: Record<SystemRoleCode, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  WAITER: 'Waiter',
  CASHIER: 'Cashier',
  KITCHEN_STAFF: 'Kitchen Staff',
  RECEPTIONIST: 'Receptionist',
  BRANCH_SCOPED: 'Branch-Scoped (no restaurant-wide access)',
};
