import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation primitives. Import `Link`, `useRouter`,
 * `usePathname`, `redirect` and `getPathname` from HERE rather than from
 * `next/link` / `next/navigation` — they automatically prefix the active
 * locale, so a plain href like `/docs/menu-management` resolves to
 * `/hy/docs/menu-management` when the user is on the Armenian site.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
