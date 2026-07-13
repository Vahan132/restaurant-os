/**
 * LOCALE-1 — shared supported-locale set + parsing/fallback helpers.
 *
 * The app supports three content locales. This is the single source of truth for
 * the set on the SHARED side (the inventory dish-projection has its own private
 * `toLocale` for the owner recipe path; not refactored here to avoid churn — both
 * agree on `hy|ru|en`).
 */
import { I18nText } from './i18n-text';

export const SUPPORTED_LOCALES = ['hy', 'ru', 'en'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** True for exactly `hy`/`ru`/`en`. */
export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Parse an arbitrary signal (header value, query, column) to a supported locale,
 * or `null` when absent/blank/unsupported. Case-insensitive, trimmed. Returning
 * `null` (rather than defaulting) lets the caller fall back to a lower-priority
 * source (e.g. the restaurant default) before landing on `'en'`.
 */
export function parseLocale(value: string | null | undefined): Locale | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return isSupportedLocale(normalized) ? normalized : null;
}

/**
 * LOCALE-1 effective locale: the guest's requested locale wins, else the
 * restaurant's default language, else `'en'`. Both the requested value and the
 * restaurant default are validated against the supported set (an unsupported
 * default degrades to `'en'`, never leaks through).
 */
export function resolveEffectiveLocale(
  requested: Locale | null,
  restaurantDefault: string | null | undefined,
): Locale {
  return requested ?? parseLocale(restaurantDefault) ?? 'en';
}

/**
 * LOCALE-2B — resolve a trilingual value for display: the translation in `locale`
 * if present, else the `primary` (the required canonical column). A null primary
 * with no translation yields null (nullable descriptions). Locale-exhaustive over
 * `hy|ru|en`. The generic keeps a non-null primary returning a non-null string.
 */
export function resolveI18n<P extends string | null>(
  locale: Locale,
  i18n: I18nText,
  primary: P,
): string | P {
  return i18n[locale] ?? primary;
}
