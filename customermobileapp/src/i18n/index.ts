import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { secureStore } from '@/lib/secure-store';
import { en } from './locales/en';
import { hy } from './locales/hy';
import { ru } from './locales/ru';

/** Locales the app ships. `hy` is the ultimate fallback. */
export const SUPPORTED_LOCALES = ['hy', 'ru', 'en'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'hy';

/** Narrow an arbitrary string to a supported `AppLocale`. */
export function isSupportedLocale(code: string | null | undefined): code is AppLocale {
  return !!code && (SUPPORTED_LOCALES as readonly string[]).includes(code);
}

/** Resolve the device's preferred locale down to one we support, else fallback. */
export function resolveDeviceLocale(): AppLocale {
  const preferred = getLocales();
  for (const l of preferred) {
    const code = (l.languageCode ?? '').toLowerCase();
    if (isSupportedLocale(code)) {
      return code;
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
  // Synchronous seed so the first render already has a language: device → 'hy'.
  // The persisted choice (if any) is applied a beat later by `hydrateStoredLocale`,
  // giving the full boot resolution order: AsyncStorage(store) → device → 'hy'.
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

/**
 * LOCALE-2D — apply the persisted guest locale on boot, if one was saved.
 *
 * Boot resolution order is store → device → 'hy': i18n is already seeded with
 * device→'hy' above, so here we only override when a VALID stored locale exists.
 * Called once from the root layout during launch hydration.
 */
export async function hydrateStoredLocale(): Promise<void> {
  try {
    const stored = await secureStore.get(secureStore.keys.locale);
    if (isSupportedLocale(stored) && stored !== i18n.language) {
      await i18n.changeLanguage(stored);
    }
  } catch {
    // Storage read failed (e.g. Expo Go) — keep the device-derived seed.
  }
}

/** LOCALE-2D — persist the chosen locale so it survives relaunch. Fire-and-forget safe. */
export async function persistLocale(locale: AppLocale): Promise<void> {
  try {
    await secureStore.set(secureStore.keys.locale, locale);
  } catch {
    // Non-fatal: the in-memory `changeLanguage` still took effect this session.
  }
}

export default i18n;
