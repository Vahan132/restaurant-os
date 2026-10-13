import type { PublicHoursResponse } from '@/api/generated/model';
import { todayHours } from './hours';

/**
 * Hours formatting for the detail Overview row + weekly list.
 * Pure (no i18n inside) so it stays testable; callers supply localized labels
 * (weekday names, "Today", "Closed") from i18n.
 *
 * Spec `dayOfWeek` is 0=Mon … 6=Sun; `crossesMidnight` means closesAt < opensAt.
 */

/** "20:00 – 03:00", or null when the row is closed / missing times. */
export function formatRange(row: PublicHoursResponse | null | undefined): string | null {
  if (!row || row.isClosed || !row.opensAt || !row.closesAt) return null;
  return `${row.opensAt} – ${row.closesAt}`;
}

/** Today's row derived from the weekly schedule (re-exported convenience). */
export function pickTodayRow(
  weeklyHours: PublicHoursResponse[] | null | undefined,
  date: Date = new Date(),
): PublicHoursResponse | null {
  return todayHours(weeklyHours, date);
}

/** Weekly rows in Mon→Sun order (spec dayOfWeek), de-duplicated by day. */
export function orderedWeek(
  weeklyHours: PublicHoursResponse[] | null | undefined,
): PublicHoursResponse[] {
  if (!weeklyHours) return [];
  return [...weeklyHours].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

/** Convert JS getDay() (0=Sun..6=Sat) → spec dayOfWeek (0=Mon..6=Sun). */
export function todaySpecDay(date: Date = new Date()): number {
  return (date.getDay() + 6) % 7;
}
