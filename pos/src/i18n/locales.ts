export const locales = ['en', 'ru', 'hy'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

/** Cookie that holds the active UI locale (no URL prefix — POS is a single-locale-per-device app). */
export const LOCALE_COOKIE = 'pos-locale';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  ru: 'Русский',
  hy: 'Հայերեն',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}
