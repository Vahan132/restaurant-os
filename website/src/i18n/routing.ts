import { defineRouting } from "next-intl/routing";
import { locales, defaultLocale } from "@/config/i18n";

/**
 * Shared next-intl routing definition. Path-based locales (/en, /hy, /ru) so
 * each locale has a real URL for hreflang + per-locale SEO. `localePrefix:
 * "always"` keeps the prefix on every route (including the default locale), so
 * `/` redirects to `/en` and the three locales are symmetric.
 *
 * Locale list is the single source of truth in `src/config/i18n.ts`.
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
});
