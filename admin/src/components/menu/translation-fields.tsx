'use client';

import {
  fromI18nDraft,
  toI18nDraft,
  EMPTY_I18N,
  type I18nDraft,
} from '@/components/consumer-listing/i18n-text-editor';
import { Field, inputClass } from '@/components/ui/form';
import { defaultLocale, isLocale, locales, localeNames, type Locale } from '@/i18n/config';

/**
 * LOCALE-2C: optional per-language authoring inputs for the two NON-primary
 * languages of a menu entity (item / category / modifier group / option).
 *
 * The form keeps its existing primary `name`/`description` field (labeled with
 * the restaurant's default language); this renders the remaining two locales,
 * derived from `hy|ru|en` minus the primary. The primary language's own
 * translation column is never authored here — resolution falls back to `name`.
 *
 * Reuses the consumer-listing `{hy,ru,en}` draft helpers for a consistent shape.
 */

export { EMPTY_I18N, toI18nDraft, type I18nDraft };

/** Resolve the restaurant's raw defaultLanguage string to a known UI locale. */
export function resolvePrimaryLocale(primaryLocale: string | null | undefined): Locale {
  return isLocale(primaryLocale) ? primaryLocale : defaultLocale;
}

/** Human-readable name of the restaurant's primary (default) language. */
export function primaryLocaleName(primaryLocale: string | null | undefined): string {
  return localeNames[resolvePrimaryLocale(primaryLocale)];
}

/**
 * Map a draft to the flat `name*` DTO fields, sending only the two NON-primary
 * locales. Empty input -> `null` (clears on update); the primary locale's column
 * is `undefined` (omitted -> unchanged / not sent).
 */
export function nameTranslationFields(
  primaryLocale: string | null | undefined,
  draft: I18nDraft,
): { nameHy?: string | null; nameRu?: string | null; nameEn?: string | null } {
  const primary = resolvePrimaryLocale(primaryLocale);
  const p = fromI18nDraft(draft);
  return {
    nameHy: primary === 'hy' ? undefined : p.hy,
    nameRu: primary === 'ru' ? undefined : p.ru,
    nameEn: primary === 'en' ? undefined : p.en,
  };
}

/** Same as {@link nameTranslationFields} for the flat `description*` DTO fields. */
export function descriptionTranslationFields(
  primaryLocale: string | null | undefined,
  draft: I18nDraft,
): {
  descriptionHy?: string | null;
  descriptionRu?: string | null;
  descriptionEn?: string | null;
} {
  const primary = resolvePrimaryLocale(primaryLocale);
  const p = fromI18nDraft(draft);
  return {
    descriptionHy: primary === 'hy' ? undefined : p.hy,
    descriptionRu: primary === 'ru' ? undefined : p.ru,
    descriptionEn: primary === 'en' ? undefined : p.en,
  };
}

export function TranslationFields({
  primaryLocale,
  label,
  value,
  onChange,
  multiline = false,
  rows = 2,
  disabled = false,
}: {
  /** The restaurant's default language (raw string, e.g. 'hy'/'ru'/'en'). */
  primaryLocale: string | null | undefined;
  /** Base field label, e.g. the localized "Name" or "Description". */
  label: string;
  value: I18nDraft;
  onChange: (next: I18nDraft) => void;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
}) {
  const primary = resolvePrimaryLocale(primaryLocale);
  const others = locales.filter((l) => l !== primary);
  const set = (locale: Locale, text: string) => onChange({ ...value, [locale]: text });

  return (
    <>
      {others.map((locale) => (
        <Field key={locale} label={`${label} (${localeNames[locale]})`}>
          {multiline ? (
            <textarea
              className={inputClass}
              rows={rows}
              value={value[locale]}
              disabled={disabled}
              onChange={(e) => set(locale, e.target.value)}
            />
          ) : (
            <input
              className={inputClass}
              value={value[locale]}
              disabled={disabled}
              onChange={(e) => set(locale, e.target.value)}
            />
          )}
        </Field>
      ))}
    </>
  );
}
