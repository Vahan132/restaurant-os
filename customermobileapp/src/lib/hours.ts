/**
 * todayHours — derive today's opening-hours row from a weekly schedule.
 *
 * Built now; used by the detail screen in CX-APP-1. The API's `weeklyHours[]` uses
 * `dayOfWeek` where **0 = Monday … 6 = Sunday** (per the spec). JavaScript's
 * `Date.getDay()` uses 0 = Sunday … 6 = Saturday, so we convert.
 *
 * `crossesMidnight` (closesAt < opensAt) is carried through untouched — callers use it
 * to render e.g. "18:00 – 02:00" spanning into the next day.
 */

/** Mirrors the spec's `PublicHoursResponse`. */
export interface WeeklyHour {
  /** 0 = Monday … 6 = Sunday. */
  dayOfWeek: number;
  isClosed: boolean;
  /** "HH:mm" or null. */
  opensAt: string | null;
  /** "HH:mm" or null. */
  closesAt: string | null;
  /** closesAt < opensAt ⇒ slot crosses midnight. */
  crossesMidnight: boolean;
}

/** Convert JS `getDay()` (0=Sun..6=Sat) → spec dayOfWeek (0=Mon..6=Sun). */
export function jsDayToSpecDay(jsDay: number): number {
  return (jsDay + 6) % 7;
}

/**
 * Return the schedule row matching `date`'s weekday, or null if none exists.
 * @param weeklyHours rows from the API (any length; may omit some days)
 * @param date the reference date (defaults to now — i.e. the device's "today")
 */
export function todayHours(
  weeklyHours: WeeklyHour[] | null | undefined,
  date: Date = new Date(),
): WeeklyHour | null {
  if (!weeklyHours || weeklyHours.length === 0) return null;
  const target = jsDayToSpecDay(date.getDay());
  return weeklyHours.find((h) => h.dayOfWeek === target) ?? null;
}
