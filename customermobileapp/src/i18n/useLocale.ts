import { useCallback, useSyncExternalStore } from 'react';
import i18n, { type AppLocale, SUPPORTED_LOCALES } from './index';

/**
 * useLocale — current app locale + an in-memory setter.
 *
 * Language selection is NOT persisted here (that is a Profile / CX-2 concern). This just
 * exposes the active locale and a setter that updates i18next live. `pickI18n` /
 * `pickLabel` read `locale` to choose the active-language field from API responses.
 */
export function useLocale(): {
  locale: AppLocale;
  setLocale: (next: AppLocale) => void;
  supported: readonly AppLocale[];
} {
  const locale = useSyncExternalStore(
    (cb) => {
      i18n.on('languageChanged', cb);
      return () => i18n.off('languageChanged', cb);
    },
    () => normalize(i18n.language),
    () => normalize(i18n.language),
  );

  const setLocale = useCallback((next: AppLocale) => {
    void i18n.changeLanguage(next);
  }, []);

  return { locale, setLocale, supported: SUPPORTED_LOCALES };
}

function normalize(lng: string | undefined): AppLocale {
  const code = (lng ?? '').slice(0, 2).toLowerCase();
  return (SUPPORTED_LOCALES as readonly string[]).includes(code)
    ? (code as AppLocale)
    : 'hy';
}
