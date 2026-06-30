import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { en } from './locales/en';
import { hy } from './locales/hy';
import { ru } from './locales/ru';

/** Locales the app ships. `hy` is the ultimate fallback. */
export const SUPPORTED_LOCALES = ['hy', 'ru', 'en'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'hy';

/** Resolve the device's preferred locale down to one we support, else fallback. */
export function resolveDeviceLocale(): AppLocale {
  const preferred = getLocales();
  for (const l of preferred) {
    const code = (l.languageCode ?? '').toLowerCase();
    if ((SUPPORTED_LOCALES as readonly string[]).includes(code)) {
      return code as AppLocale;
    }
  }
  return DEFAULT_LOCALE;
}

export const resources = {
  hy,
  ru,
  en,
} as const;

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: resolveDeviceLocale(),
    fallbackLng: DEFAULT_LOCALE, // → 'hy'
    defaultNS: 'common',
    ns: ['common'],
    interpolation: { escapeValue: false }, // RN does its own escaping
    returnNull: false,
  });
}

export default i18n;
