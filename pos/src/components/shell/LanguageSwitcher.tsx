'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { locales, localeNames, LOCALE_COOKIE, type Locale } from '@/i18n/locales';

/**
 * Touch-friendly locale switcher. Writes the locale cookie and refreshes so the
 * server re-renders with the new messages (no URL prefix).
 */
export function LanguageSwitcher() {
  const activeLocale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setLocale(locale: Locale) {
    if (locale === activeLocale) return;
    document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000;samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex select-none overflow-hidden rounded-xl border border-gray-300">
      {locales.map((locale) => {
        const active = locale === activeLocale;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => setLocale(locale)}
            disabled={pending}
            aria-pressed={active}
            title={localeNames[locale]}
            className={`min-h-tap px-4 text-base font-semibold uppercase transition-colors active:scale-95 ${
              active ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'
            }`}
          >
            {locale}
          </button>
        );
      })}
    </div>
  );
}
