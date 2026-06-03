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
  AUDIT_VIEW: 'AUDIT_VIEW',
  DASHBOARD_VIEW: 'DASHBOARD_VIEW',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
