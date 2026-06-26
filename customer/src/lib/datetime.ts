/**
 * Timezone helpers for the public reservation flow.
 *
 * The customer always thinks in the RESTAURANT'S local time (the IANA zone from
 * `/public/reservations/info`). The form collects a wall-clock date + time in
 * that zone; we must send the backend a precise UTC instant (`reservedAt`) and
 * render every time back in the restaurant zone — never the device zone.
 *
 * No date library is used (none is installed): everything is built on the
 * standard `Intl.DateTimeFormat` + `Date.UTC`, which know the IANA database
 * (including DST rules).
 */

/**
 * Offset (ms) of `timeZone` from UTC at the given instant, i.e.
 * `localWallClock - utc`. Positive east of UTC (e.g. Asia/Yerevan ⇒ +4h).
 */
function tzOffsetMs(instant: Date, timeZone: string): number {
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
  const parts = dtf.formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  // The same instant expressed as the zone's wall clock, read back as if it were UTC.
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24, // h23 emits 24 for midnight in some engines
    get('minute'),
    get('second'),
  );
  return asUtc - instant.getTime();
}

/**
 * Convert a wall-clock date + time MEANT in `timeZone` to the matching UTC
 * `Date`. Two passes settle the offset correctly across DST boundaries.
 *
 * @param date "YYYY-MM-DD" (restaurant-local calendar date)
 * @param time "HH:mm" (restaurant-local 24h time)
 */
export function zonedWallTimeToUtc(date: string, time: string, timeZone: string): Date | null {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  if ([y, mo, d, h, mi].some((n) => n === undefined || Number.isNaN(n))) return null;

  // First guess: pretend the wall clock is already UTC, then correct by the
  // zone offset at that approximate instant, and refine once more.
  const guess = Date.UTC(y!, mo! - 1, d!, h!, mi!);
  let utc = guess - tzOffsetMs(new Date(guess), timeZone);
  utc = guess - tzOffsetMs(new Date(utc), timeZone);
  return new Date(utc);
}

/** Current wall-clock "YYYY-MM-DD" in `timeZone` (for the date input's `min`). */
export function todayInZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Human-readable date + time for a UTC instant, rendered in the restaurant zone
 * and localized to `locale`. e.g. "Saturday, June 20, 2026 at 7:30 PM".
 */
export function formatInZone(utcIso: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(utcIso));
}

/** Short timezone label (e.g. "GMT+4") for showing which zone times are in. */
export function zoneAbbrev(timeZone: string, locale: string): string {
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone,
    timeZoneName: 'short',
  }).formatToParts(new Date());
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? timeZone;
}
