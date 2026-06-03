/** Common currency codes offered in the profile (free-form on the backend). */
export const CURRENCIES = ['AMD', 'USD', 'RUB', 'EUR', 'GBP', 'GEL'];

/** UI locales supported by the app. */
export const LANGUAGES = ['hy', 'ru', 'en'];

/** Curated IANA timezone list; the current value is merged in if missing. */
export const TIMEZONES = [
  'UTC',
  'Asia/Yerevan',
  'Europe/Moscow',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tbilisi',
  'Asia/Dubai',
  'America/New_York',
  'America/Los_Angeles',
];

/** Ensure a value is present in a list (so the current saved value is selectable). */
export function withValue(list: string[], value?: string | null): string[] {
  if (value && !list.includes(value)) return [value, ...list];
  return list;
}
