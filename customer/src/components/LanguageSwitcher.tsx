'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { locales, localeNames, LOCALE_COOKIE, type Locale } from '@/i18n/config';

export default function LanguageSwitcher() {
  const t = useTranslations('language');
  const active = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  function change(next: Locale) {
    // Persist for one year; no locale path segment (path is the slug).
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    // The menu is fetched client-side via React Query with locale-independent
    // keys, so router.refresh() (RSC only) won't re-request it. Invalidate so the
    // next fetch carries the new X-Locale and localized content replaces the
    // stale copy immediately.
    void queryClient.invalidateQueries();
    startTransition(() => router.refresh());
  }

  return (
    <label className="flex items-center gap-1 text-sm">
      <span className="sr-only">{t('label')}</span>
      <select
        aria-label={t('label')}
        value={active}
        disabled={isPending}
        onChange={(e) => change(e.target.value as Locale)}
        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-800 shadow-sm focus:border-brand-accent focus:outline-none"
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
