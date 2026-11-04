/**
 * PLANS-1 — RestOS subscription packages (Start / Pro / Chain).
 *
 * Source: "RestOS — Product Functionality & Subscription Packages" doc
 * (draft prices, AMD per branch per month; annual = 2 months free).
 * Each package is seeded as TWO Plan rows (MONTH + YEAR) because a Plan row
 * carries a single interval.
 *
 * Prices here are MAJOR units (AMD). They are converted to the stored integer
 * minor units with the same Intl rule the API/admin/website use for display
 * (currency fraction digits), so 19,900 shows as 19,900 AMD everywhere.
 *
 * `features` keeps EXACTLY the four PlanFeaturesDto keys (the API validates with
 * forbidNonWhitelisted, so extra keys would break editing in Platform Admin).
 * enabledModules are the feature flags from the package matrix; nothing in the
 * API gates on them yet (open decision "plan enforcement in code").
 */

export type PlanInterval = 'MONTH' | 'YEAR';

export interface PlanSeed {
  code: string;
  name: string;
  /** Major units (AMD). */
  price: number;
  currency: string;
  interval: PlanInterval;
  features: {
    maxRestaurants: number;
    maxBranchesPerRestaurant: number;
    maxUsers: number;
    enabledModules: string[];
  };
}

/** "Unlimited within fair use" for users/devices. */
const FAIR_USE_USERS = 1000;

/** Included in every plan (never gate compliance). */
const START_MODULES = [
  'POS',
  'ORDERS',
  'TABLES',
  'KDS',
  'MENU',
  'QR_MENU',
  'PAYMENTS',
  'ONLINE_PAYMENTS',
  'FISCAL_HDM',
  'EDGE_HUB',
  'STAFF',
  'STAFF_PIN',
  'RESERVATIONS',
  'SALES_REPORTS',
  'EXCEL_EXPORT_SALES',
];

/** Pro = control food cost, stock and profit. */
const PRO_MODULES = [
  ...START_MODULES,
  'CUSTOM_ROLES',
  'RECIPES',
  'INVENTORY',
  'FIFO_COST',
  'PRODUCTION',
  'INVENTORY_DAILY_REPORT',
  'PRODUCT_SALES_REPORT',
  'PROFIT_REPORT',
  'EXPENSES',
  'EXCEL_EXPORT_ALL',
  'AUDIT_LOG',
  'SALES_IMPORT',
  'UNLIMITED_REPORT_HISTORY',
];

/** Chain = run several branches from one admin. */
const CHAIN_MODULES = [
  ...PRO_MODULES,
  'MULTI_BRANCH',
  'BRANCH_REPORTS',
  'BRANCH_TRANSFERS',
  'BRANCH_SCOPED_ROLES',
  'IIKO_MIGRATION',
];

const START = {
  maxRestaurants: 1,
  maxBranchesPerRestaurant: 1,
  maxUsers: FAIR_USE_USERS,
  enabledModules: START_MODULES,
};
const PRO = {
  maxRestaurants: 1,
  maxBranchesPerRestaurant: 1,
  maxUsers: FAIR_USE_USERS,
  enabledModules: PRO_MODULES,
};
const CHAIN = {
  maxRestaurants: 1,
  maxBranchesPerRestaurant: 50,
  maxUsers: FAIR_USE_USERS,
  enabledModules: CHAIN_MODULES,
};

export const PLANS: PlanSeed[] = [
  { code: 'start', name: 'Start', price: 19_900, currency: 'AMD', interval: 'MONTH', features: START },
  { code: 'start-annual', name: 'Start (annual)', price: 199_000, currency: 'AMD', interval: 'YEAR', features: START },
  { code: 'pro', name: 'Pro', price: 39_900, currency: 'AMD', interval: 'MONTH', features: PRO },
  { code: 'pro-annual', name: 'Pro (annual)', price: 399_000, currency: 'AMD', interval: 'YEAR', features: PRO },
  // Chain is priced PER BRANCH (minimum 2 branches) — the row holds the per-branch price.
  { code: 'chain', name: 'Chain (per branch)', price: 34_900, currency: 'AMD', interval: 'MONTH', features: CHAIN },
  { code: 'chain-annual', name: 'Chain (per branch, annual)', price: 349_000, currency: 'AMD', interval: 'YEAR', features: CHAIN },
];

/** Legacy dev plan from SEED-1 — kept (subscriptions may reference it) but deactivated. */
export const LEGACY_PLAN_CODES = ['starter'];

/** Plan the demo organization (2 branches) is subscribed to. */
export const DEMO_ORG_PLAN_CODE = 'chain';

/** Currency fraction digits via Intl (same rule as API/admin/website); 2 when unknown. */
export function currencyDecimals(currency: string): number {
  try {
    return (
      new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

export function toMinorUnits(major: number, currency: string): number {
  return Math.round(major * 10 ** currencyDecimals(currency));
}
