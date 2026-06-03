/**
 * Pricing plans — local config for now.
 *
 * Holds only structural/numeric data (ids, amounts, currency, popularity,
 * feature keys, comparison structure). All human-readable text — plan names,
 * taglines, feature labels, comparison rows, FAQ — lives in the message
 * catalogs under the `plans` / `pricing` namespaces and is resolved by the
 * components, so pricing is fully i18n-ed.
 *
 * Amounts are integer minor units + currency so real currency formatting / live
 * pricing can be wired in W2 without touching the UI.
 */

export type PlanPrice = {
  amount: number;
  currency: string;
  interval: "month" | "year";
};

export type Plan = {
  id: string;
  price: PlanPrice;
  /** Catalog keys under `plans.features.*` for this plan's bullet list. */
  featureKeys: string[];
  /** Marketing CTA destination. */
  href: string;
  /** Visually highlighted as the recommended tier. */
  popular?: boolean;
};

export const plans: Plan[] = [
  {
    id: "starter",
    price: { amount: 2900, currency: "USD", interval: "month" },
    featureKeys: [
      "fastPos",
      "menuMgmt",
      "qrOrdering",
      "oneKds",
      "dailySummary",
      "emailSupport",
    ],
    href: "/signup?plan=starter",
  },
  {
    id: "growth",
    price: { amount: 7900, currency: "USD", interval: "month" },
    popular: true,
    featureKeys: [
      "everythingStarter",
      "tablesFloor",
      "reservationsWaitlist",
      "unlimitedKds",
      "realtimeReports",
      "staffRoles",
      "priorityChat",
    ],
    href: "/signup?plan=growth",
  },
  {
    id: "pro",
    price: { amount: 16900, currency: "USD", interval: "month" },
    featureKeys: [
      "everythingGrowth",
      "multiLocation",
      "consolidatedReporting",
      "menuSync",
      "advancedAnalytics",
      "apiWebhooks",
      "dedicatedManager",
    ],
    href: "/signup?plan=pro",
  },
];

/** Generic display price, e.g. "$29". Real currency formatting is wired later. */
export function formatPrice(price: PlanPrice): string {
  const major = Math.round(price.amount / 100);
  return `$${major}`;
}

/**
 * Feature comparison matrix. `values` are either a boolean (check/dash), a
 * literal number string ("1", "6"), or a key under `plans.comparison.values.*`
 * (e.g. "unlimited") resolved at render time.
 */
export type ComparisonRow = {
  featureKey: string;
  values: Record<string, boolean | string>;
};

export type ComparisonGroup = {
  groupKey: string;
  rows: ComparisonRow[];
};

export const comparison: ComparisonGroup[] = [
  {
    groupKey: "service",
    rows: [
      { featureKey: "posOrderTaking", values: { starter: true, growth: true, pro: true } },
      { featureKey: "kdsScreens", values: { starter: "1", growth: "unlimited", pro: "unlimited" } },
      { featureKey: "tablesFloor", values: { starter: false, growth: true, pro: true } },
      { featureKey: "reservationsWaitlist", values: { starter: false, growth: true, pro: true } },
      { featureKey: "qrOrdering", values: { starter: true, growth: true, pro: true } },
    ],
  },
  {
    groupKey: "insights",
    rows: [
      { featureKey: "dailySummary", values: { starter: true, growth: true, pro: true } },
      { featureKey: "realtimeReports", values: { starter: false, growth: true, pro: true } },
      { featureKey: "advancedAnalytics", values: { starter: false, growth: false, pro: true } },
      { featureKey: "consolidatedReporting", values: { starter: false, growth: false, pro: true } },
    ],
  },
  {
    groupKey: "team",
    rows: [
      { featureKey: "terminals", values: { starter: "2", growth: "6", pro: "unlimited" } },
      { featureKey: "staffRoles", values: { starter: false, growth: true, pro: true } },
      { featureKey: "apiWebhooks", values: { starter: false, growth: false, pro: true } },
      {
        featureKey: "support",
        values: { starter: "email", growth: "priorityChat", pro: "dedicatedManager" },
      },
    ],
  },
];

/** FAQ entry keys, in display order. Text lives under `plans.faq.<key>`. */
export const faqKeys = ["trial", "change", "hardware", "cut", "portable"] as const;
