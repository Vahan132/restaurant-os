import type { PermissionScope } from '@/lib/auth/use-permission';
import { PERMISSIONS, type PermissionKey } from '@/lib/permissions';

export interface NavChild {
  /** Translation key under the `nav` namespace. */
  key: string;
  href: string;
}

export interface NavItem {
  /** Translation key under the `nav` namespace. */
  key: string;
  href: string;
  /** User needs at least one of these permissions to see the item. */
  anyOf: PermissionKey[];
  /**
   * Permission resolution scope (BR-7). Branch-scoped items (menu, inventory,
   * orders, tables, reservations, dashboard, reports, catalog tools) resolve at
   * the active branch; restaurant-level items (branch management, users,
   * settings, audit) resolve restaurant-wide. Defaults to `branch`.
   */
  scope?: PermissionScope;
  /**
   * Optional sub-navigation. When present the item renders as a section
   * header with these children (children inherit the section's `anyOf`).
   */
  children?: NavChild[];
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
  {
    key: 'inventory',
    href: '/inventory/stock',
    anyOf: [
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.INVENTORY_ITEM_MANAGE,
      PERMISSIONS.INVENTORY_RECEIPT_CREATE,
      PERMISSIONS.INVENTORY_ADJUSTMENT_CREATE,
      PERMISSIONS.INVENTORY_PROCESS_MANAGE,
      PERMISSIONS.INVENTORY_PROCESS_RUN,
      PERMISSIONS.INVENTORY_WRITEOFF_CREATE,
      PERMISSIONS.INVENTORY_WRITEOFF_VOID,
    ],
    children: [
      { key: 'invStock', href: '/inventory/stock' },
      { key: 'invItems', href: '/inventory/items' },
      { key: 'invReceipts', href: '/inventory/goods-receipts' },
      { key: 'invAdjustments', href: '/inventory/adjustments' },
      { key: 'invProcesses', href: '/inventory/processes' },
      { key: 'invRuns', href: '/inventory/process-runs' },
      { key: 'invCosting', href: '/inventory/menu-costing' },
      { key: 'invWriteoffs', href: '/inventory/write-offs' },
      { key: 'invSuppliers', href: '/inventory/suppliers' },
      { key: 'invCategories', href: '/inventory/categories' },
    ],
  },
  {
    key: 'catalogTools',
    href: '/catalog-tools',
    anyOf: [
      PERMISSIONS.MENU_MANAGE,
      PERMISSIONS.INVENTORY_ITEM_MANAGE,
      PERMISSIONS.INVENTORY_RECIPE_MANAGE,
      PERMISSIONS.INVENTORY_PROCESS_MANAGE,
    ],
  },
  { key: 'reports', href: '/reports', anyOf: [PERMISSIONS.REPORTS_VIEW] },
  {
    key: 'branches',
    href: '/branches',
    anyOf: [PERMISSIONS.BRANCH_MANAGE],
    scope: 'restaurant',
  },
  {
    key: 'hubs',
    href: '/hubs',
    anyOf: [PERMISSIONS.EDGE_MANAGE],
    scope: 'restaurant',
  },
  {
    key: 'users',
    href: '/users',
    anyOf: [PERMISSIONS.USER_MANAGE],
    scope: 'restaurant',
  },
  {
    key: 'settings',
    href: '/settings',
    anyOf: [PERMISSIONS.SETTINGS_MANAGE],
    scope: 'restaurant',
  },
  {
    key: 'audit',
    href: '/audit',
    anyOf: [PERMISSIONS.AUDIT_VIEW],
    scope: 'restaurant',
  },
];
