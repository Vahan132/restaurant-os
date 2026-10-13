/**
 * Pure stats/cursor logic (R-AND-1 §4) — no native imports, fully unit-tested.
 * Kept separate from storage.ts (which pulls in expo-secure-store) so the cursor
 * rules can be exercised in plain Node.
 */
import { ReportedCall, SyncStats } from '../types';

export const MAX_RECENT = 50;

/** Local YYYY-MM-DD key for "reported today" bucketing. */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Fold a batch of newly reported calls into existing stats.
 *
 * Pure and total: never lowers the cursor (guards clock skew / out-of-order
 * batches) and only advances `lastReportedAt` to the newest epoch actually
 * reported. Caller must only invoke this on a CONFIRMED 200.
 */
export function applyReported(
  prev: SyncStats,
  reported: ReportedCall[],
  now: Date = new Date()
): SyncStats {
  if (reported.length === 0) {
    return { ...prev, lastSyncAt: now.toISOString() };
  }

  const newestEpoch = reported.reduce((max, c) => Math.max(max, c.epochMs), 0);

  const perDay = { ...prev.perDay };
  for (const call of reported) {
    const key = dayKey(new Date(call.epochMs));
    perDay[key] = (perDay[key] ?? 0) + 1;
  }

  const recent = [...reported]
    .sort((a, b) => b.epochMs - a.epochMs)
    .concat(prev.recent)
    .slice(0, MAX_RECENT);

  return {
    lastReportedAt: Math.max(prev.lastReportedAt, newestEpoch),
    lastSyncAt: now.toISOString(),
    totalReported: prev.totalReported + reported.length,
    perDay,
    recent,
  };
}

export function reportedToday(stats: SyncStats, now: Date = new Date()): number {
  return stats.perDay[dayKey(now)] ?? 0;
}
