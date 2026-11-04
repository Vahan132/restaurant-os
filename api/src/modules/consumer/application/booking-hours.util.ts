import { zonedDayRange } from '../../reservations/application/timezone.util';
import { BookingOpenWindow } from '../../reservations/domain/services/slot-derivation';
import { PublicHoursRecord } from '../domain/repositories/branch-public.repository';

const MIN_MS = 60_000;
const DAY_MIN = 24 * 60;

/** Parse "HH:mm" → minutes since local midnight, or null if malformed. */
function parseHhmm(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) {
    return null;
  }
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) {
    return null;
  }
  return h * 60 + min;
}

/** Calendar weekday of YYYY-MM-DD in the BranchPublicHours scheme (0=Mon … 6=Sun). */
export function weekdayMonFirst(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).getUTCDay(); // 0=Sun … 6=Sat
  return (dow + 6) % 7; // → 0=Mon … 6=Sun
}

/**
 * Resolve a branch's stored public hours for a local calendar date into absolute
 * [startMs, endMs) booking windows (the reservation domain's slot derivation works
 * in epoch-ms). Returns [] when the branch is closed that day or the row is
 * missing/malformed. A `closesAt <= opensAt` row crosses midnight. DST shifts
 * within the day are not modelled (matches the existing daily-boundary util).
 */
export function resolveOpenWindows(
  dateStr: string,
  hours: PublicHoursRecord[],
  timezone: string,
): BookingOpenWindow[] {
  const weekday = weekdayMonFirst(dateStr);
  const row = hours.find((h) => h.dayOfWeek === weekday);
  if (!row || row.isClosed) {
    return [];
  }
  const opensMin = parseHhmm(row.opensAt);
  const closesMin = parseHhmm(row.closesAt);
  if (opensMin === null || closesMin === null) {
    return [];
  }
  const localMidnight = zonedDayRange(dateStr, timezone).start.getTime();
  const startMs = localMidnight + opensMin * MIN_MS;
  // closes at/before opens ⇒ the window runs past midnight into the next day.
  const closeMin = closesMin <= opensMin ? closesMin + DAY_MIN : closesMin;
  const endMs = localMidnight + closeMin * MIN_MS;
  return [{ startMs, endMs }];
}
