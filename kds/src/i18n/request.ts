import { getRequestConfig } from 'next-intl/server';
import { getUserLocale } from './locale';

// Cookie-based locale (no URL prefix) — simpler routing for a single-screen kiosk.
export default getRequestConfig(async () => {
  const locale = await getUserLocale();
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
