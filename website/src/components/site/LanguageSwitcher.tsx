"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, localeNames, type Locale } from "@/config/i18n";

/**
 * Locale switcher used in the header and footer. Navigates to the same path
 * under the chosen locale via the next-intl router, which also writes the
 * NEXT_LOCALE cookie so the choice persists across visits.
 */
export function LanguageSwitcher() {
  const t = useTranslations("footer");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function onSelect(next: Locale) {
    if (next === locale) return;
    startTransition(() => {
      // `pathname` from next-intl is already locale-stripped and carries the
      // resolved segments (e.g. /docs/menu-management), so re-navigating with
      // the new locale lands on the same page in that language.
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm text-muted">
      <span className="sr-only">{t("chooseLanguage")}</span>
      <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 text-muted" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M3 12h18M12 3c2.5 2.5 3.5 6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-6-3.5-9s1-6.5 3.5-9Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
      <select
        value={locale}
        disabled={isPending}
        onChange={(e) => onSelect(e.target.value as Locale)}
        className="cursor-pointer rounded-md border border-line bg-paper px-2.5 py-1.5 text-sm text-ink-soft transition-colors hover:border-terracotta/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-terracotta disabled:opacity-60"
      >
        {locales.map((l) => (
          <option key={l} value={l}>
            {localeNames[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
