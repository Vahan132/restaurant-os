/**
 * SEED-2 history clock — the business-day calendar the history phase (15) seeds
 * into, expressed in the restaurant timezone.
 *
 * The history window is the HISTORY_DAYS business days BEFORE today (today itself
 * is covered by phase 11). Opening balances (phase 07) are backdated to the
 * morning before the window opens so every history day draws FIFO from stock that
 * already existed at that time — the daily inventory report then shows sane
 * opening/closing figures for every day in the window.
 *
 * Override the window length with SEED_HISTORY_DAYS (0 disables phase 15).
 */
import { RESTAURANT } from './data/core';

export const HISTORY_DAYS = (() => {
  const raw = process.env.SEED_HISTORY_DAYS;
  const n = raw === undefined ? 45 : Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 45;
})();

export const TZ: string = RESTAURANT.timezone;

export interface LocalDay {
  y: number;
  m: number; // 1-12
  d: number;
  /** YYYY-MM-DD */
  iso: string;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
}

/** Offset (ms) of `tz` from UTC at instant `at`. */
function tzOffsetMs(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (t: string): number => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Local wall-clock time in the restaurant timezone → UTC instant. */
export function localTime(day: LocalDay, hour: number, minute = 0, second = 0): Date {
  const guess = Date.UTC(day.y, day.m - 1, day.d, hour, minute, second);
  let t = guess - tzOffsetMs(new Date(guess), TZ);
  t = guess - tzOffsetMs(new Date(t), TZ);
  return new Date(t);
}

function toLocalDay(y: number, m: number, d: number): LocalDay {
  const dt = new Date(Date.UTC(y, m - 1, d));
  const yy = dt.getUTCFullYear();
  const mm = dt.getUTCMonth() + 1;
  const dd = dt.getUTCDate();
  return {
    y: yy,
    m: mm,
    d: dd,
    iso: `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`,
    weekday: dt.getUTCDay(),
  };
}

/** Today's business date in the restaurant timezone. */
export function todayLocal(now = new Date()): LocalDay {
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now); // YYYY-MM-DD
  const [y, m, d] = iso.split('-').map(Number);
  return toLocalDay(y, m, d);
}

/** The business day `n` days before today (n = 1 → yesterday). */
export function daysAgo(n: number, now = new Date()): LocalDay {
  const t = todayLocal(now);
  return toLocalDay(t.y, t.m, t.d - n);
}

/** Oldest-first list of the history window's business days. */
export function historyDays(now = new Date()): LocalDay[] {
  const out: LocalDay[] = [];
  for (let n = HISTORY_DAYS; n >= 1; n--) {
    out.push(daysAgo(n, now));
  }
  return out;
}

/**
 * When opening balances are received: 08:00 local on the day BEFORE the window
 * (or "now" when history is disabled, preserving SEED-1 behaviour).
 */
export function openingBalanceAt(now = new Date()): Date {
  if (HISTORY_DAYS === 0) {
    return now;
  }
  return localTime(daysAgo(HISTORY_DAYS + 1, now), 8, 0);
}

/** Small deterministic PRNG (mulberry32) so every run seeds the same history. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
