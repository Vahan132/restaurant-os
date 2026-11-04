import { applyReported, dayKey, reportedToday } from '../storage/statsLogic';
import { EMPTY_STATS, ReportedCall, SyncStats } from '../types';

const call = (epochMs: number, phone = '+1555'): ReportedCall => ({
  phoneNumber: phone,
  occurredAt: new Date(epochMs).toISOString(),
  epochMs,
  reportedAt: new Date(epochMs).toISOString(),
});

describe('applyReported', () => {
  it('records a heartbeat without touching the cursor on an empty batch', () => {
    const prev: SyncStats = { ...EMPTY_STATS, lastReportedAt: 5000, totalReported: 2 };
    const next = applyReported(prev, []);
    expect(next.lastReportedAt).toBe(5000);
    expect(next.totalReported).toBe(2);
    expect(next.lastSyncAt).not.toBeNull();
  });

  it('advances the cursor to the newest reported epoch', () => {
    const next = applyReported({ ...EMPTY_STATS }, [call(1000), call(3000), call(2000)]);
    expect(next.lastReportedAt).toBe(3000);
    expect(next.totalReported).toBe(3);
  });

  it('never lowers the cursor (clock skew / reorder guard)', () => {
    const prev: SyncStats = { ...EMPTY_STATS, lastReportedAt: 9000 };
    const next = applyReported(prev, [call(1000)]);
    expect(next.lastReportedAt).toBe(9000);
  });

  it('keeps recent newest-first and capped at 50', () => {
    let stats: SyncStats = { ...EMPTY_STATS };
    for (let i = 1; i <= 60; i++) stats = applyReported(stats, [call(i * 1000)]);
    expect(stats.recent.length).toBe(50);
    expect(stats.recent[0]!.epochMs).toBe(60000);
    expect(stats.totalReported).toBe(60);
  });
});

describe('reportedToday', () => {
  it('counts only entries bucketed under today', () => {
    const now = new Date();
    const todayEpoch = now.getTime();
    const yesterday = todayEpoch - 24 * 3600 * 1000;
    let stats = applyReported({ ...EMPTY_STATS }, [call(todayEpoch), call(todayEpoch - 1000)]);
    stats = applyReported(stats, [call(yesterday)]);
    expect(reportedToday(stats, now)).toBe(2);
  });
});

describe('dayKey', () => {
  it('formats YYYY-MM-DD', () => {
    expect(dayKey(new Date(2026, 5, 26))).toBe('2026-06-26');
  });
});
