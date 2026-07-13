import { useCallback, useSyncExternalStore } from 'react';
import { queryClient } from '@/api/query-client';
import i18n, { type AppLocale, SUPPORTED_LOCALES, persistLocale } from './index';

/**
 * useLocale — current app locale + a persisting setter.
 *
 * `setLocale` (LOCALE-2D) updates i18next live, persists the choice to storage so it
 * survives relaunch, and invalidates cached queries so localized content refetches with
 * the new `X-Locale` header. `pickI18n` / `pickLabel` read `locale` to choose the
 * active-language field from API responses.
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
    if (next === normalize(i18n.language)) return;
    void i18n.changeLanguage(next);
    void persistLocale(next);
    // New language ⇒ subsequent requests carry the new X-Locale, so localized content
    // (menu, discovery detail, …) must refetch. Invalidate all queries to reload it.
    void queryClient.invalidateQueries();
  }, []);

  return { locale, setLocale, supported: SUPPORTED_LOCALES };
}

function normalize(lng: string | undefined): AppLocale {
  const code = (lng ?? '').slice(0, 2).toLowerCase();
  return (SUPPORTED_LOCALES as readonly string[]).includes(code)
    ? (code as AppLocale)
    : 'hy';
}
