/**
 * Permission catalog mirroring the backend. Keep in sync with the API's
 * permission seed (GET /permissions). Values are the wire keys checked against
 * `user.permissions` returned by GET /auth/me.
 */
export const PERMISSIONS = {
  MENU_MANAGE: 'MENU_MANAGE',
  TABLE_MANAGE: 'TABLE_MANAGE',
  TABLE_STATUS_UPDATE: 'TABLE_STATUS_UPDATE',
  ORDER_CREATE: 'ORDER_CREATE',
  ORDER_EDIT: 'ORDER_EDIT',
  ORDER_CANCEL: 'ORDER_CANCEL',
  DISCOUNT_APPLY: 'DISCOUNT_APPLY',
  PAYMENT_PROCESS: 'PAYMENT_PROCESS',
  REPORTS_VIEW: 'REPORTS_VIEW',
  RESERVATION_MANAGE: 'RESERVATION_MANAGE',
  KDS_ACCESS: 'KDS_ACCESS',
  USER_MANAGE: 'USER_MANAGE',
  ROLE_MANAGE: 'ROLE_MANAGE',
  SETTINGS_MANAGE: 'SETTINGS_MANAGE',
  // Multi-branch management (BR-3/BR-7). Restaurant-wide permission.
  BRANCH_MANAGE: 'BRANCH_MANAGE',
  // Edge hub registration + monitoring (OFF-8). Restaurant-wide permission.
  EDGE_MANAGE: 'EDGE_MANAGE',
  AUDIT_VIEW: 'AUDIT_VIEW',
  DASHBOARD_VIEW: 'DASHBOARD_VIEW',
  // Inventory (INV-1). Write keys are the colon-style keys registered by the
  // backend (surfaced in the 403 messages of the inventory endpoints). No
  // explicit read key is published by the spec, so we follow the established
  // convention `inventory:read` for view gating; adjust here if the backend
  // seeds a different read key.
  INVENTORY_READ: 'inventory:read',
  INVENTORY_ITEM_MANAGE: 'inventory:item:manage',
  INVENTORY_RECEIPT_CREATE: 'inventory:receipt:create',
  INVENTORY_ADJUSTMENT_CREATE: 'inventory:adjustment:create',
  // Inventory processes (INV-2).
  INVENTORY_PROCESS_MANAGE: 'inventory:process:manage',
  INVENTORY_PROCESS_RUN: 'inventory:process:run',
  // Recipes & dish costing (INV-3).
  INVENTORY_RECIPE_MANAGE: 'inventory:recipe:manage',
  // Fine-grained sell-price permission (separate from MENU_MANAGE).
  MENU_ITEM_SET_PRICE: 'menu:item:set_price',
  // Write-offs (INV-4).
  INVENTORY_WRITEOFF_CREATE: 'inventory:writeoff:create',
  INVENTORY_WRITEOFF_VOID: 'inventory:writeoff:void',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
