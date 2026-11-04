import type { AppLocale } from '@/i18n';

/**
 * Helpers for the two i18n field shapes the API returns. Fallback order is always:
 *   active locale → hy → ru → en → '' (empty string, never null/undefined).
 *
 * Built now; consumed by CX-APP-1 (e.g. `about`, photo `alt`, taxonomy labels).
 */

/** Matches the spec's `I18nTextResponse { hy, ru, en }` (members nullable). */
export interface I18nText {
  hy?: string | null;
  ru?: string | null;
  en?: string | null;
}

/** Matches per-column taxonomy fields: `{ labelHy, labelRu, labelEn }`. */
export interface LabelFields {
  labelHy?: string | null;
  labelRu?: string | null;
  labelEn?: string | null;
}

const ORDER: AppLocale[] = ['hy', 'ru', 'en'];

function firstNonEmpty(candidates: (string | null | undefined)[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return '';
}

/**
 * pickI18n — resolve an `I18nTextResponse` to the active-locale string with fallback.
 * Returns '' when no language has a value (or field is null/undefined).
 */
export function pickI18n(field: I18nText | null | undefined, locale: AppLocale): string {
  if (!field) return '';
  const order = [locale, ...ORDER.filter((l) => l !== locale)];
  return firstNonEmpty(order.map((l) => field[l]));
}

/**
 * pickLabel — resolve `labelHy/labelRu/labelEn` to the active-locale string with fallback.
 * Returns '' when no language has a value.
 */
export function pickLabel(obj: LabelFields | null | undefined, locale: AppLocale): string {
  if (!obj) return '';
  const map: Record<AppLocale, string | null | undefined> = {
    hy: obj.labelHy,
    ru: obj.labelRu,
    en: obj.labelEn,
  };
  const order = [locale, ...ORDER.filter((l) => l !== locale)];
  return firstNonEmpty(order.map((l) => map[l]));
}
