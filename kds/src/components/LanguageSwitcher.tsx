'use client';

import { useLocale } from 'next-intl';
import { useTransition } from 'react';
import { setUserLocale } from '@/i18n/locale';
import { Locale, localeNames, locales } from '@/i18n/locales';

/** Compact locale selector. Persists to a cookie and refreshes server messages. */
export function LanguageSwitcher() {
  const current = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as Locale;
    startTransition(() => {
      void setUserLocale(next).then(() => {
        // Re-render the tree with the new server-provided messages.
        window.location.reload();
      });
    });
  }

  return (
    <select
      aria-label="Language"
      value={current}
      onChange={onChange}
      disabled={isPending}
      className="rounded-md border border-kiosk-border bg-kiosk-panel px-3 py-2 text-base text-kiosk-text"
    >
      {locales.map((loc) => (
        <option key={loc} value={loc}>
          {localeNames[loc]}
        </option>
      ))}
    </select>
  );
}
