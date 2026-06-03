/**
 * Navigation models, shared by header, footer, and the docs layout.
 *
 * These hold only structure (hrefs, grouping, slugs). All human-readable
 * labels live in the message catalogs and are resolved by the consuming
 * components via the relevant translation key, so navigation is fully i18n-ed.
 */

/** Primary header navigation. `key` → `nav.<key>` in the catalog. */
export type NavLink = { key: string; href: string };

export const mainNav: NavLink[] = [
  { key: "features", href: "/#features" },
  { key: "pricing", href: "/pricing" },
  { key: "docs", href: "/docs" },
  { key: "about", href: "/about" },
];

/** Footer columns. Column `key` → `footer.columns.<key>`, link `key` → `footer.links.<key>`. */
export const footerNav: { key: string; links: NavLink[] }[] = [
  {
    key: "product",
    links: [
      { key: "features", href: "/#features" },
      { key: "pricing", href: "/pricing" },
      { key: "howItWorks", href: "/#how-it-works" },
      { key: "getStarted", href: "/signup" },
    ],
  },
  {
    key: "documentation",
    links: [
      { key: "gettingStarted", href: "/docs/getting-started" },
      { key: "pos", href: "/docs/pos-order-taking" },
      { key: "kds", href: "/docs/kitchen-display" },
      { key: "reports", href: "/docs/reports-dashboard" },
    ],
  },
  {
    key: "company",
    links: [
      { key: "about", href: "/about" },
      { key: "login", href: "/login" },
      { key: "privacy", href: "/legal/privacy" },
      { key: "terms", href: "/legal/terms" },
    ],
  },
];

/**
 * Docs sidebar sections. `slug` is the doc id; the label is resolved from
 * `docs.pages.<slug>` and the section title from `docs.sections.<key>`.
 */
export type DocsNavItem = { slug: string; href: string };
export type DocsNavSection = { key: string; items: DocsNavItem[] };

export const docsNav: DocsNavSection[] = [
  {
    key: "getStarted",
    items: [
      { slug: "getting-started", href: "/docs/getting-started" },
      { slug: "setup-restaurant", href: "/docs/setup-restaurant" },
    ],
  },
  {
    key: "build",
    items: [
      { slug: "menu-management", href: "/docs/menu-management" },
      { slug: "tables-floor-plan", href: "/docs/tables-floor-plan" },
    ],
  },
  {
    key: "runService",
    items: [
      { slug: "pos-order-taking", href: "/docs/pos-order-taking" },
      { slug: "kitchen-display", href: "/docs/kitchen-display" },
      { slug: "reservations", href: "/docs/reservations" },
      { slug: "qr-menu", href: "/docs/qr-menu" },
    ],
  },
  {
    key: "grow",
    items: [
      { slug: "reports-dashboard", href: "/docs/reports-dashboard" },
      { slug: "account-billing", href: "/docs/account-billing" },
    ],
  },
];

/** Flat list of docs pages, in reading order (used for prev/next + slugs). */
export const docsFlat: DocsNavItem[] = docsNav.flatMap((s) => s.items);

/** Just the slugs, for generateStaticParams in the docs route. */
export const docsSlugs: string[] = docsFlat.map((d) => d.slug);
