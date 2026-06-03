import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import { defaultLocale, isLocale, LOCALE_COOKIE } from './config';

/**
 * Resolves the active locale from the LOCALE cookie (set by the language
 * switcher) and loads the matching messages bundle. Falls back to the default
 * locale; browser/restaurant-based defaults can be layered in later.
 */
export default getRequestConfig(async () => {
  const cookieLocale = cookies().get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
