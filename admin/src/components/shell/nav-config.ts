import { PERMISSIONS, type PermissionKey } from '@/lib/permissions';

export interface NavItem {
  /** Translation key under the `nav` namespace. */
  key: string;
  href: string;
  /** User needs at least one of these permissions to see the item. */
  anyOf: PermissionKey[];
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', href: '/', anyOf: [PERMISSIONS.DASHBOARD_VIEW] },
  { key: 'menu', href: '/menu', anyOf: [PERMISSIONS.MENU_MANAGE] },
  {
    key: 'tables',
    href: '/tables',
    anyOf: [PERMISSIONS.TABLE_MANAGE, PERMISSIONS.TABLE_STATUS_UPDATE],
  },
  { key: 'qr', href: '/qr-codes', anyOf: [PERMISSIONS.TABLE_MANAGE] },
  {
    key: 'reservations',
    href: '/reservations',
    anyOf: [PERMISSIONS.RESERVATION_MANAGE],
  },
  {
    key: 'orders',
    href: '/orders',
    anyOf: [PERMISSIONS.ORDER_CREATE, PERMISSIONS.ORDER_EDIT],
  },
  { key: 'reports', href: '/reports', anyOf: [PERMISSIONS.REPORTS_VIEW] },
  { key: 'users', href: '/users', anyOf: [PERMISSIONS.USER_MANAGE] },
  { key: 'settings', href: '/settings', anyOf: [PERMISSIONS.SETTINGS_MANAGE] },
  { key: 'audit', href: '/audit', anyOf: [PERMISSIONS.AUDIT_VIEW] },
];
