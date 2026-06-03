/**
 * i18n scaffolding.
 *
 * The site ships English-only for now, but content and chrome are structured
 * so additional locales (Armenian, Russian) can be layered in later without a
 * rewrite: the language switcher in the footer reads from `locales`, and copy
 * that will eventually be translated is grouped in config rather than inlined.
 */
export const locales = ["en", "hy", "ru"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  hy: "Հայերեն",
  ru: "Русский",
};
