/**
 * Timezone helpers. The backend stores reservation times as UTC ISO strings;
 * the UI displays and inputs them in the restaurant's timezone (from
 * GET /restaurant). No external date library is used — just Intl.
 */

/**
 * Return a time zone Intl accepts. Repairs the legacy signup value
 * "Etc/GMT+ 8" (stray space) and falls back to the browser zone, then UTC.
 */
export function safeTimeZone(timeZone: string | null | undefined): string {
  const candidates = [
    timeZone?.replace(/\s+/g, ''),
    typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined,
  ];
  for (const tz of candidates) {
    if (!tz) continue;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return tz;
    } catch {
      /* try next */
    }
  }
  return 'UTC';
}

/** Offset (minutes) of a timezone from UTC at a given instant. */
function tzOffsetMinutes(timeZone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimeZone(timeZone),
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(at);
  const map: Record<string, number> = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = Number(p.value);
  const asTz = Date.UTC(
    map.year!,
    map.month! - 1,
    map.day!,
    map.hour === 24 ? 0 : map.hour!,
    map.minute!,
    map.second!,
  );
  return Math.round((asTz - at.getTime()) / 60000);
}

/** Current calendar day (YYYY-MM-DD) in the given timezone. */
export function todayInTz(timeZone: string): string {
  return ymdInTz(new Date(), timeZone);
}

/** Calendar day (YYYY-MM-DD) of an instant, in the given timezone. */
export function ymdInTz(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
  return `${map.year}-${map.month}-${map.day}`;
}

/**
 * Convert a wall-clock date+time *in `timeZone`* to a UTC ISO string.
 * `ymd` = "YYYY-MM-DD", `hm` = "HH:mm".
 */
export function zonedToUtcISO(ymd: string, hm: string, timeZone: string): string {
  const naive = new Date(`${ymd}T${hm}:00Z`);
  const offset = tzOffsetMinutes(timeZone, naive);
  return new Date(naive.getTime() - offset * 60000).toISOString();
}

/** "HH:mm" wall-clock time of a UTC ISO string in `timeZone` (for inputs). */
export function isoToZonedTime(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: safeTimeZone(timeZone),
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(iso));
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
  const hh = map.hour === '24' ? '00' : map.hour;
  return `${hh}:${map.minute}`;
}

/** Format an instant as a localized time in the restaurant timezone. */
export function formatTimeInTz(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: safeTimeZone(timeZone),
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** Format an instant as date + time in the restaurant timezone. */
export function formatDateTimeInTz(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: safeTimeZone(timeZone),
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}
