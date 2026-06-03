'use server';

import { cookies } from 'next/headers';

import { isLocale, LOCALE_COOKIE, type Locale } from './config';

/** Persists the chosen locale in a cookie so the server can render messages. */
export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;
  cookies().set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
