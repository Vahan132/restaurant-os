"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { docsFlat } from "@/config/nav";

/** Prev / next navigation derived from the flat docs reading order. */
export function DocsPager() {
  const t = useTranslations("docs");
  const pathname = usePathname();
  const idx = docsFlat.findIndex((d) => d.href === pathname);
  if (idx === -1) return null;

  const prev = idx > 0 ? docsFlat[idx - 1] : null;
  const next = idx < docsFlat.length - 1 ? docsFlat[idx + 1] : null;

  return (
    <nav
      aria-label={t("pager.label")}
      className="mt-14 grid gap-4 border-t border-line pt-8 sm:grid-cols-2"
    >
      {prev ? (
        <Link
          href={prev.href}
          className="group flex flex-col gap-1 rounded-xl border border-line bg-paper p-4 transition-colors hover:border-terracotta/40"
        >
          <span className="flex items-center gap-1.5 text-2xs font-bold uppercase leading-none tracking-eyebrow text-muted">
            <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" fill="none" aria-hidden>
              <path d="M10 6H2M5 3 2 6l3 3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t("pager.prev")}
          </span>
          <span className="font-medium text-ink group-hover:text-terracotta-ink">
            {t(`pages.${prev.slug}`)}
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={next.href}
          className="group flex flex-col gap-1 rounded-xl border border-line bg-paper p-4 text-right transition-colors hover:border-terracotta/40 sm:col-start-2"
        >
          <span className="flex items-center justify-end gap-1.5 text-2xs font-bold uppercase leading-none tracking-eyebrow text-muted">
            {t("pager.next")}
            <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" fill="none" aria-hidden>
              <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="font-medium text-ink group-hover:text-terracotta-ink">
            {t(`pages.${next.slug}`)}
          </span>
        </Link>
      ) : null}
    </nav>
  );
}
