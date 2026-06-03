'use server';

import { cookies } from 'next/headers';
import { defaultLocale, Locale, locales } from './locales';

const COOKIE_NAME = 'NEXT_LOCALE';

/** Read the kiosk's selected locale from the cookie (defaults to en). */
export async function getUserLocale(): Promise<Locale> {
  const value = cookies().get(COOKIE_NAME)?.value;
  return locales.includes(value as Locale) ? (value as Locale) : defaultLocale;
}

/** Persist a locale choice. Called by the language switcher. */
export async function setUserLocale(locale: Locale): Promise<void> {
  cookies().set(COOKIE_NAME, locale, { path: '/', maxAge: 60 * 60 * 24 * 365 });
}
