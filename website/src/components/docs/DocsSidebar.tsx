"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { docsNav } from "@/config/nav";
import { cn } from "@/lib/cn";

/**
 * Docs section navigation with a client-side filter. Typing narrows the list
 * to matching pages; empty query shows the full grouped nav. Labels come from
 * the catalog so the nav is localized.
 */
export function DocsSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("docs");
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docsNav;
    return docsNav
      .map((s) => ({
        ...s,
        items: s.items.filter((i) => t(`pages.${i.slug}`).toLowerCase().includes(q)),
      }))
      .filter((s) => s.items.length > 0);
  }, [query, t]);

  return (
    <nav aria-label={t("sidebar.nav")} className="flex flex-col gap-6">
      <div className="relative">
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          fill="none"
        >
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
          <path d="m14 14 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("sidebar.search")}
          aria-label={t("sidebar.searchAria")}
          className="w-full rounded-pill border border-line bg-paper py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-muted focus-visible:border-terracotta/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-terracotta"
        />
      </div>

      {sections.length === 0 ? (
        <p className="px-1 text-sm text-muted">{t("sidebar.noMatch", { query })}</p>
      ) : (
        sections.map((section) => (
          <div key={section.key} className="flex flex-col gap-1.5">
            <p className="px-3 text-2xs font-semibold uppercase tracking-eyebrow text-muted">
              {t(`sections.${section.key}`)}
            </p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block rounded-md px-3 py-1.5 text-sm transition-colors duration-fast",
                        active
                          ? "bg-terracotta-soft font-semibold text-terracotta-ink"
                          : "text-ink-soft hover:bg-sand/70 hover:text-ink",
                      )}
                    >
                      {t(`pages.${item.slug}`)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </nav>
  );
}
