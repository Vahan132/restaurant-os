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
  // Multi-location inventory (6A). Granted to OWNER/MANAGER automatically (they
  // hold ALL_PERMISSIONS, reconciled at token-issue). Reads reuse INVENTORY_READ;
  // counted-on-hand corrections reuse INVENTORY_ADJUSTMENT_CREATE.
  // - LOCATION_MANAGE: create/rename/delete branch stock locations (shelves).
  INVENTORY_LOCATION_MANAGE: 'inventory:location:manage',
  // - POLICY_MANAGE: set the branch negative-stock mode (ALLOW/WARN/BLOCK).
  INVENTORY_POLICY_MANAGE: 'inventory:policy:manage',
  // - TRANSFER_CREATE: move stock between two locations of a branch (6B).
  INVENTORY_TRANSFER_CREATE: 'inventory:transfer:create',
  // Edge nodes (OFF-2): register/list/revoke on-prem edge hubs. Restaurant-wide
  // (checked against the JWT permission snapshot, NOT branch-resolved). Granted
  // to OWNER/MANAGER automatically (they hold ALL_PERMISSIONS); existing roles
  // are backfilled by the OFF-2 migration.
  EDGE_MANAGE: 'EDGE_MANAGE',
  // Device-anchored staff auth (3A). Granted to OWNER/MANAGER automatically (they
  // hold ALL_PERMISSIONS); existing roles are backfilled by the 3A migration.
  // - DEVICE_ENROLL: enroll / list / revoke in-store devices for a branch.
  //   BRANCH-SCOPED — checked against the caller's EFFECTIVE permissions at the
  //   active branch (X-Branch-Id).
  DEVICE_ENROLL: 'device.enroll',
  // - STAFF_PIN_MANAGE: create / reset / revoke a staff member's POS/KDS PIN.
  //   RESTAURANT-WIDE — a user's PIN works at any POS/KDS in the restaurant, so
  //   it is checked against the role snapshot, not branch-resolved.
  STAFF_PIN_MANAGE: 'staff.pin.manage',
  // Historical / external sales import (5A): upload a CSV of non-fiscal,
  // reports-only sales and view import batches. RESTAURANT-WIDE (checked against
  // the JWT permission snapshot); per-row branch reach is still enforced against
  // the importer's accessible branches. Granted to OWNER/MANAGER automatically
  // (they hold ALL_PERMISSIONS); existing roles are backfilled by the 5A migration.
  // Reading the imported-sales ANALYTICS reuses REPORTS_VIEW.
  SALES_IMPORT_MANAGE: 'sales:import:manage',
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
  // 7A: senior kitchen roles that operate the KDS and may execute production
  // runs. They hold the process-run capability (inventory:process:run) by
  // default; plain KITCHEN_STAFF does not. Seeded per org; existing orgs are
  // backfilled by the 7A migration.
  'CHEF',
  'SOUS_CHEF',
  'RECEPTIONIST',
  // BR-1 sentinel. A user assigned this role has NO restaurant-wide access; their
  // access is granted ONLY through BranchMemberships (a role per branch). This is
  // how an admin marks a user "branch-scoped" while keeping User.roleId non-null.
  'BRANCH_SCOPED',
] as const;

export type SystemRoleCode = (typeof SYSTEM_ROLE_CODES)[number];

/** Type guard: is `code` one of the canonical system-role codes? */
export function isSystemRoleCode(code: string): code is SystemRoleCode {
  return (SYSTEM_ROLE_CODES as readonly string[]).includes(code);
}

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
  // 7A: Chef / Sous-Chef run production from the KDS. They get KDS access, read
  // inventory (to see stock while prepping), and the process-run capability. They
  // do NOT get inventory:process:manage (defining processes stays with OWNER/
  // MANAGER) or any sell-side permissions.
  CHEF: [
    PERMISSIONS.KDS_ACCESS,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_PROCESS_RUN,
  ],
  SOUS_CHEF: [
    PERMISSIONS.KDS_ACCESS,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_PROCESS_RUN,
  ],
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
  CHEF: false,
  SOUS_CHEF: false,
  RECEPTIONIST: false,
  BRANCH_SCOPED: false,
};

/** True if a role grants ALL-BRANCH reach (FIX-E). Null-safe. */
export function hasAllBranches(role: { allBranches?: boolean } | null | undefined): boolean {
  return role?.allBranches === true;
}

/**
 * The permission snapshot to embed in an access token / return from /auth/me for
 * a role.
 *
 * SYSTEM roles are RECONCILED to the catalog (`SYSTEM_ROLE_PERMISSIONS`) so that
 * newly added catalog permissions reach existing OWNER / MANAGER / etc. WITHOUT a
 * manual per-feature backfill + a perfectly-timed migration. (Access tokens still
 * snapshot permissions, so a fresh login is required for a new snapshot to take
 * effect — but no DB backfill race.) The migration backfills the stored rows too,
 * which keeps branch-scoped effective-permission resolution correct.
 *
 * CUSTOM (non-system) roles use their stored permission set verbatim.
 */
export function snapshotPermissionsForRole(
  role: { code: string; isSystem: boolean; permissions: readonly string[] } | null | undefined,
): string[] {
  if (!role) return [];
  if (role.isSystem && isSystemRoleCode(role.code)) {
    return [...SYSTEM_ROLE_PERMISSIONS[role.code]];
  }
  return [...role.permissions];
}

/** Human-friendly default names for the system roles (used by the seed). */
export const SYSTEM_ROLE_NAMES: Record<SystemRoleCode, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  WAITER: 'Waiter',
  CASHIER: 'Cashier',
  KITCHEN_STAFF: 'Kitchen Staff',
  CHEF: 'Chef',
  SOUS_CHEF: 'Sous-Chef',
  RECEPTIONIST: 'Receptionist',
  BRANCH_SCOPED: 'Branch-Scoped (no restaurant-wide access)',
};
