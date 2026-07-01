import type { AppLocale } from '@/i18n';

/** Map our app locale to a BCP-47 tag for Intl formatting. */
const localeTag: Record<AppLocale, string> = {
  hy: 'hy-AM',
  ru: 'ru-RU',
  en: 'en-US',
};

/** Local "YYYY-MM-DD" key (NOT UTC) — what the slots endpoint expects. */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** `n` forward-looking days starting today, each as `{ key, date }`. */
export function forwardDays(n: number): { key: string; date: Date }[] {
  const out: { key: string; date: Date }[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push({ key: toDateKey(d), date: d });
  }
  return out;
}

function fmt(d: Date, locale: AppLocale, opts: Intl.DateTimeFormatOptions, fallback: () => string): string {
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(localeTag[locale], opts).format(d);
  } catch {
    return fallback();
  }
}

/** "14:30" — locale-aware time of day from an ISO string. */
export function formatTime(iso: string, locale: AppLocale): string {
  const d = new Date(iso);
  return fmt(d, locale, { hour: '2-digit', minute: '2-digit' }, () =>
    Number.isNaN(d.getTime()) ? '' : d.toTimeString().slice(0, 5),
  );
}

/** "Mon, 7 Jul · 14:30" — full reserved-at label. */
export function formatDateTime(iso: string, locale: AppLocale): string {
  const d = new Date(iso);
  return fmt(
    d,
    locale,
    { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
    () => (Number.isNaN(d.getTime()) ? '' : d.toLocaleString()),
  );
}

/** Short two-line date-strip label parts: weekday + day-of-month. */
export function dateStripLabel(date: Date, locale: AppLocale): { weekday: string; day: string } {
  return {
    weekday: fmt(date, locale, { weekday: 'short' }, () => ''),
    day: fmt(date, locale, { day: 'numeric' }, () => String(date.getDate())),
  };
}
