/**
 * Pure parsing helpers for imported-sale cells (5A). No framework imports.
 * Documented, tolerant rules — see CSV_SCHEMA.md.
 */

/** True when `d` is a real calendar date matching the supplied y/m/d. */
function isRealDate(d: Date, y: number, m: number, day: number): boolean {
  return (
    !Number.isNaN(d.getTime()) &&
    d.getUTCFullYear() === y &&
    d.getUTCMonth() === m - 1 &&
    d.getUTCDate() === day
  );
}

/**
 * Parse a sale timestamp. Accepts ISO-8601 (`2026-03-01T13:45:00Z`),
 * `YYYY-MM-DD`, `YYYY-MM-DD HH:mm[:ss]` (assumed UTC), and `MM/DD/YYYY`
 * (optionally with a time). Returns null if unparseable / not a real date.
 */
export function parseOccurredAt(raw: string): Date | null {
  const t = raw.trim();
  if (t === '') return null;

  // MM/DD/YYYY (US) with optional time.
  const slash = t.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (slash) {
    const [, mm, dd, yyyy, hh = '0', mi = '0', ss = '0'] = slash;
    const d = new Date(Date.UTC(+yyyy, +mm - 1, +dd, +hh, +mi, +ss));
    return isRealDate(d, +yyyy, +mm, +dd) ? d : null;
  }

  // ISO date or date-time (space or T separator; tz optional → assume UTC).
  const iso = t.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/,
  );
  if (iso) {
    let s = t.includes(' ') ? t.replace(' ', 'T') : t;
    if (!s.includes('T')) s += 'T00:00:00Z';
    else if (!/(Z|[+-]\d{2}:?\d{2})$/.test(s)) s += 'Z';
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/**
 * Parse a money cell into INTEGER MINOR UNITS (e.g. cents), HALF_UP rounded to 2
 * decimals. Strips currency symbols, spaces, and thousands separators; `.` is the
 * decimal separator. Returns null if empty or not a valid number.
 */
export function parseMoneyToMinor(raw: string): number | null {
  const t = raw.trim();
  if (t === '') return null;
  const cleaned = t.replace(/[^0-9.\-]/g, '');
  if (!/^-?\d*\.?\d*$/.test(cleaned) || !/\d/.test(cleaned)) return null;

  const neg = cleaned.startsWith('-');
  const abs = neg ? cleaned.slice(1) : cleaned;
  const [intPart = '0', fracRaw = ''] = abs.split('.');
  const frac2 = (fracRaw + '00').slice(0, 2);
  let minor = Number(intPart || '0') * 100 + Number(frac2);
  // HALF_UP using the 3rd fractional digit.
  if (fracRaw.length > 2 && fracRaw.charCodeAt(2) - 48 >= 5) minor += 1;
  return neg ? -minor : minor;
}

/** Parse a positive integer quantity. Returns null if not an integer ≥ 1. */
export function parseQuantity(raw: string): number | null {
  const t = raw.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 ? n : null;
}
