'use client';

import { useTranslations } from 'next-intl';

import { inputClass } from '@/components/ui/form';
import { locales, localeNames, type Locale } from '@/i18n/config';

/** Plain editable form of an i18n text field (hy/ru/en), never null. */
export type I18nDraft = Record<Locale, string>;

export const EMPTY_I18N: I18nDraft = { en: '', ru: '', hy: '' };

/** Build an editable draft from a nullable API i18n object. */
export function toI18nDraft(
  value: { hy?: string | null; ru?: string | null; en?: string | null } | null | undefined,
): I18nDraft {
  return {
    en: value?.en ?? '',
    ru: value?.ru ?? '',
    hy: value?.hy ?? '',
  };
}

/** Convert a draft back to an API i18n payload (empty strings become null). */
export function fromI18nDraft(draft: I18nDraft): { hy: string | null; ru: string | null; en: string | null } {
  const norm = (s: string) => (s.trim() === '' ? null : s.trim());
  return { en: norm(draft.en), ru: norm(draft.ru), hy: norm(draft.hy) };
}

export function I18nTextEditor({
  value,
  onChange,
  disabled,
  multiline,
  rows = 3,
}: {
  value: I18nDraft;
  onChange: (next: I18nDraft) => void;
  disabled?: boolean;
  multiline?: boolean;
  rows?: number;
}) {
  const t = useTranslations('consumerListing');
  const set = (locale: Locale, text: string) => onChange({ ...value, [locale]: text });

  return (
    <div className="space-y-2">
      {locales.map((locale) => (
        <div key={locale} className="flex items-start gap-2">
          <span className="mt-2 w-16 shrink-0 text-xs font-medium uppercase text-gray-500">
            {localeNames[locale]}
          </span>
          {multiline ? (
            <textarea
              className={inputClass}
              rows={rows}
              value={value[locale]}
              disabled={disabled}
              placeholder={t('i18nPlaceholder', { lang: localeNames[locale] })}
              onChange={(e) => set(locale, e.target.value)}
            />
          ) : (
            <input
              className={inputClass}
              value={value[locale]}
              disabled={disabled}
              placeholder={t('i18nPlaceholder', { lang: localeNames[locale] })}
              onChange={(e) => set(locale, e.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
