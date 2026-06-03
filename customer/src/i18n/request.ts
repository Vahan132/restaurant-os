import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import { defaultLocale, isLocale, LOCALE_COOKIE } from './config';

/**
 * Locale is chosen client-side and persisted in a cookie (no locale path
 * segment — the first path segment is reserved for the restaurant slug).
 */
export default getRequestConfig(async () => {
  const cookie = cookies().get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookie) ? cookie : defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
