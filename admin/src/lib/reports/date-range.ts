import { todayInTz } from '@/lib/tz';

export type RangePreset = 'today' | 'week' | 'month' | 'custom';
export type GroupBy = 'day' | 'week' | 'month';

export interface DateRange {
  from: string; // YYYY-MM-DD (restaurant tz)
  to: string;
}

/** Calendar-day arithmetic on a YYYY-MM-DD string (UTC-based, tz-safe). */
export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function startOfWeek(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = Sunday
  const toMonday = (dow + 6) % 7;
  return addDays(ymd, -toMonday);
}

function startOfMonth(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

/** Resolve a preset into a {from,to} range for the restaurant timezone. */
export function presetRange(preset: Exclude<RangePreset, 'custom'>, timeZone: string): DateRange {
  const today = todayInTz(timeZone);
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'week':
      return { from: startOfWeek(today), to: today };
    case 'month':
      return { from: startOfMonth(today), to: today };
  }
}
