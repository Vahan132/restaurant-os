/**
 * Timezone helpers for reports. All bucketing uses the restaurant's IANA tz.
 * Uses Intl only (no extra deps); DST edges are acceptable for reporting buckets.
 */

function localParts(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const p = dtf.formatToParts(date).reduce<Record<string, string>>((a, x) => {
    a[x.type] = x.value;
    return a;
  }, {});
  return { year: Number(p.year), month: Number(p.month), day: Number(p.day) };
}

function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p = dtf.formatToParts(date).reduce<Record<string, string>>((a, x) => {
    a[x.type] = x.value;
    return a;
  }, {});
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return asUtc - date.getTime();
}

/** UTC instant of local midnight for `dateStr` (YYYY-MM-DD) in `timeZone`. */
function localMidnightUtc(dateStr: string, timeZone: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const guess = Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0);
  const offset = tzOffsetMs(new Date(guess), timeZone);
  return new Date(guess - offset);
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Today's calendar date (YYYY-MM-DD) in the timezone. */
export function todayInTz(timeZone: string, now: Date = new Date()): string {
  const { year, month, day } = localParts(now, timeZone);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** [start, end) UTC covering local calendar day `dateStr` in `timeZone`. */
export function zonedDayRange(dateStr: string, timeZone: string): { start: Date; end: Date } {
  const start = localMidnightUtc(dateStr, timeZone);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Inclusive day range: from start-of-`fromStr` to end-of-`toStr` (UTC), in tz. */
export function inclusiveDayRange(
  fromStr: string,
  toStr: string,
  timeZone: string,
): { start: Date; end: Date } {
  return {
    start: zonedDayRange(fromStr, timeZone).start,
    end: zonedDayRange(toStr, timeZone).end,
  };
}

/** Bucket label for a UTC instant, in tz: day -> YYYY-MM-DD (Monday for week), month -> YYYY-MM. */
export function bucketKey(date: Date, timeZone: string, groupBy: 'day' | 'week' | 'month'): string {
  const { year, month, day } = localParts(date, timeZone);
  if (groupBy === 'month') {
    return `${year}-${pad(month)}`;
  }
  if (groupBy === 'week') {
    // Monday-start week; compute weekday of the local calendar date.
    const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0=Sun
    const offset = (dow + 6) % 7; // days since Monday
    const monday = new Date(Date.UTC(year, month - 1, day - offset));
    return `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}
