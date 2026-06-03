/**
 * Timezone helpers for daily reservation lists. Computes the UTC instants that
 * bound a local calendar day in an IANA timezone, using Intl (no extra deps).
 * DST edge cases are acceptable for the MVP daily-list boundaries.
 */

/** Offset (localFields - utc) in ms for `date` in `timeZone`. */
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
  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

/** The [startUtc, endUtc) covering local calendar day `dateStr` (YYYY-MM-DD) in `timeZone`. */
export function zonedDayRange(dateStr: string, timeZone: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split('-').map(Number);
  // local midnight expressed as if the fields were UTC
  const guess = Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0);
  const offset = tzOffsetMs(new Date(guess), timeZone);
  const start = new Date(guess - offset);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}
