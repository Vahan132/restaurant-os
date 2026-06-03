import type { ComponentType } from "react";
import type { Locale } from "@/config/i18n";

type DocModule = {
  default: ComponentType;
  metadata: { title: string; description: string };
};

type Loader = () => Promise<DocModule>;

/**
 * Static map of locale → slug → dynamic import of the MDX doc. Literal import
 * paths keep this analyzable by the bundler (SSG-friendly). Falls back to the
 * English doc when a locale translation is missing.
 */
const loaders: Record<Locale, Record<string, Loader>> = {
  en: {
    "getting-started": () => import("./en/getting-started.mdx"),
    "setup-restaurant": () => import("./en/setup-restaurant.mdx"),
    "menu-management": () => import("./en/menu-management.mdx"),
    "tables-floor-plan": () => import("./en/tables-floor-plan.mdx"),
    "pos-order-taking": () => import("./en/pos-order-taking.mdx"),
    "kitchen-display": () => import("./en/kitchen-display.mdx"),
    reservations: () => import("./en/reservations.mdx"),
    "qr-menu": () => import("./en/qr-menu.mdx"),
    "reports-dashboard": () => import("./en/reports-dashboard.mdx"),
    "account-billing": () => import("./en/account-billing.mdx"),
  },
  hy: {
    "getting-started": () => import("./hy/getting-started.mdx"),
    "setup-restaurant": () => import("./hy/setup-restaurant.mdx"),
    "menu-management": () => import("./hy/menu-management.mdx"),
    "tables-floor-plan": () => import("./hy/tables-floor-plan.mdx"),
    "pos-order-taking": () => import("./hy/pos-order-taking.mdx"),
    "kitchen-display": () => import("./hy/kitchen-display.mdx"),
    reservations: () => import("./hy/reservations.mdx"),
    "qr-menu": () => import("./hy/qr-menu.mdx"),
    "reports-dashboard": () => import("./hy/reports-dashboard.mdx"),
    "account-billing": () => import("./hy/account-billing.mdx"),
  },
  ru: {
    "getting-started": () => import("./ru/getting-started.mdx"),
    "setup-restaurant": () => import("./ru/setup-restaurant.mdx"),
    "menu-management": () => import("./ru/menu-management.mdx"),
    "tables-floor-plan": () => import("./ru/tables-floor-plan.mdx"),
    "pos-order-taking": () => import("./ru/pos-order-taking.mdx"),
    "kitchen-display": () => import("./ru/kitchen-display.mdx"),
    reservations: () => import("./ru/reservations.mdx"),
    "qr-menu": () => import("./ru/qr-menu.mdx"),
    "reports-dashboard": () => import("./ru/reports-dashboard.mdx"),
    "account-billing": () => import("./ru/account-billing.mdx"),
  },
};

/** Load a doc for a locale, falling back to English when not yet translated. */
export function loadDoc(locale: string, slug: string): Promise<DocModule> | null {
  const loader = loaders[locale as Locale]?.[slug] ?? loaders.en[slug];
  return loader ? loader() : null;
}
