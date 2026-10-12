import type { PermissionScope } from '@/lib/auth/use-permission';
import { PERMISSIONS, type PermissionKey } from '@/lib/permissions';

export interface NavChild {
  key: string;
  href: string;
}

export interface NavItem {
  key: string;
  href: string;
  anyOf: PermissionKey[];
  scope?: PermissionScope;
  children?: NavChild[];
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', href: '/', anyOf: [PERMISSIONS.DASHBOARD_VIEW] },
  {
    key: 'menu',
    href: '/menu',
    anyOf: [PERMISSIONS.MENU_MANAGE, PERMISSIONS.MENU_STOP_LIST],
    children: [
      { key: 'menuItems', href: '/menu' },
      { key: 'menuModifierGroups', href: '/menu/modifier-groups' },
      { key: 'menuFiscalCodes', href: '/menu/fiscal-codes' },
    ],
  },
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
      PERMISSIONS.INVENTORY_LOCATION_MANAGE,
      PERMISSIONS.INVENTORY_TRANSFER_CREATE,
      PERMISSIONS.INVENTORY_PROCESS_MANAGE,
      PERMISSIONS.INVENTORY_PROCESS_RUN,
      PERMISSIONS.INVENTORY_WRITEOFF_CREATE,
      PERMISSIONS.INVENTORY_WRITEOFF_VOID,
      PERMISSIONS.EXPENSE_READ,
      PERMISSIONS.INVENTORY_SUPPLIER_MANAGE,
    ],
    children: [
      { key: 'invStock', href: '/inventory/stock' },
      { key: 'invDaily', href: '/inventory/daily-report' },
      { key: 'invReports', href: '/inventory/reports' },
      { key: 'invItems', href: '/inventory/items' },
      { key: 'invReceipts', href: '/inventory/goods-receipts' },
      { key: 'invAdjustments', href: '/inventory/adjustments' },
      { key: 'invLocations', href: '/inventory/locations' },
      { key: 'invTransfers', href: '/inventory/transfers' },
      { key: 'invCorrections', href: '/inventory/corrections' },
      { key: 'invProcesses', href: '/inventory/processes' },
      { key: 'invRuns', href: '/inventory/process-runs' },
      { key: 'invCosting', href: '/inventory/menu-costing' },
      { key: 'invWriteoffs', href: '/inventory/write-offs' },
      { key: 'invSuppliers', href: '/inventory/suppliers' },
      { key: 'invCategories', href: '/inventory/categories' },
    ],
  },
  { key: 'reports', href: '/reports', anyOf: [PERMISSIONS.REPORTS_VIEW] },
  {
    key: 'salesImport',
    href: '/sales-import',
    anyOf: [PERMISSIONS.SALES_IMPORT_MANAGE],
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
  { key: 'devices', href: '/devices', anyOf: [PERMISSIONS.DEVICE_ENROLL] },
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
    anyOf: [PERMISSIONS.USER_MANAGE, PERMISSIONS.USER_VIEW, PERMISSIONS.ROLE_MANAGE],
    scope: 'restaurant',
  },
  {
    key: 'consumerListing',
    href: '/consumer-listing',
    anyOf: [PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.RESERVATION_MANAGE],
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

/**
 * Nav keys visible when the admin runs against an EDGE hub (offline / local).
 * Operational-only: dashboard, live orders, tables, reservations, menu
 * availability/86'ing, and (read-only) reports. Everything else — menu
 * STRUCTURE, inventory, users/roles, devices, settings, cross-branch and
 * platform — is cloud-only and hidden here (and bounced by the shell guard).
 */
export const EDGE_ALLOWED_NAV_KEYS: ReadonlySet<string> = new Set([
  'dashboard',
  'orders',
  'tables',
  'reservations',
  'menu',
  'reports',
]);
