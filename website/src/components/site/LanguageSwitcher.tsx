"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, localeNames, type Locale } from "@/config/i18n";
import { cn } from "@/lib/cn";

type Props = {
  placement?: "down" | "up";
  className?: string;
};

/**
 * Locale switcher used in the header and footer. Navigates to the same path
 * under the chosen locale via the next-intl router, which also writes the
 * NEXT_LOCALE cookie so the choice persists across visits.
 */
export function LanguageSwitcher({ placement = "down", className }: Props) {
  const t = useTranslations("footer");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  function onSelect(next: Locale) {
    setOpen(false);
    if (next === locale) return;
    startTransition(() => {
      // `pathname` from next-intl is already locale-stripped and carries the
      // resolved segments (e.g. /docs/menu-management), so re-navigating with
      // the new locale lands on the same page in that language.
      router.replace(pathname, { locale: next });
    });
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        disabled={isPending}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("chooseLanguage")}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-2 rounded-pill border border-line bg-paper px-3 py-2 text-sm font-medium text-ink-soft shadow-xs",
          "transition-colors duration-fast hover:border-terracotta/40 hover:text-ink",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta",
          "disabled:opacity-60",
        )}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 text-muted" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M3 12h18M12 3c2.5 2.5 3.5 6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-6-3.5-9s1-6.5 3.5-9Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
        <span>{localeNames[locale]}</span>
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          className={cn(
            "h-3.5 w-3.5 text-muted transition-transform duration-fast",
            open && "rotate-180",
          )}
        >
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div
        role="menu"
        aria-label={t("chooseLanguage")}
        className={cn(
          "absolute left-0 z-50 w-full overflow-hidden rounded-lg border border-line bg-paper p-1 shadow-lg",
          "origin-top transition-all duration-fast ease-out-soft",
          placement === "up" ? "bottom-full mb-2 origin-bottom" : "top-full mt-2",
          open
            ? "pointer-events-auto scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0",
        )}
      >
        {locales.map((l) => {
          const active = l === locale;
          return (
            <button
              key={l}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              onClick={() => onSelect(l)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors duration-fast",
                active
                  ? "bg-sand/60 font-semibold text-terracotta-ink"
                  : "text-ink-soft hover:bg-sand/60 hover:text-ink",
              )}
            >
              <span>{localeNames[l]}</span>
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                className={cn("h-4 w-4 shrink-0 text-terracotta", !active && "opacity-0")}
              >
                <path
                  d="m5 13 4 4L19 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
