'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { setLocale } from '@/i18n/actions';
import { locales, localeNames, type Locale } from '@/i18n/config';

export function LanguageSwitcher() {
  const t = useTranslations('topbar');
  const active = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onChange = (locale: Locale) => {
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  };

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">{t('language')}</span>
      <select
        aria-label={t('language')}
        value={active}
        disabled={isPending}
        onChange={(e) => onChange(e.target.value as Locale)}
        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {localeNames[locale]}
          </option>
        ))}
      </select>
    </label>
  );
}
