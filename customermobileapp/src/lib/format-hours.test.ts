import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRange, orderedWeek, todaySpecDay } from './format-hours';
import type { PublicHoursResponse } from '@/api/generated/model';

const row = (over: Partial<PublicHoursResponse>): PublicHoursResponse => ({
  dayOfWeek: 0,
  isClosed: false,
  opensAt: '09:00',
  closesAt: '22:00',
  crossesMidnight: false,
  ...over,
});

test('formatRange formats open hours', () => {
  assert.equal(formatRange(row({})), '09:00 – 22:00');
});

test('formatRange handles a crossing-midnight row', () => {
  assert.equal(
    formatRange(row({ opensAt: '20:00', closesAt: '03:00', crossesMidnight: true })),
    '20:00 – 03:00',
  );
});

test('formatRange returns null when closed or missing times', () => {
  assert.equal(formatRange(row({ isClosed: true, opensAt: null, closesAt: null })), null);
  assert.equal(formatRange(row({ opensAt: null })), null);
  assert.equal(formatRange(null), null);
});

test('orderedWeek sorts Mon→Sun by dayOfWeek', () => {
  const wk = [row({ dayOfWeek: 6 }), row({ dayOfWeek: 0 }), row({ dayOfWeek: 3 })];
  assert.deepEqual(
    orderedWeek(wk).map((r) => r.dayOfWeek),
    [0, 3, 6],
  );
  assert.deepEqual(orderedWeek(null), []);
});

test('todaySpecDay maps a known Monday to 0 and Sunday to 6', () => {
  assert.equal(todaySpecDay(new Date('2026-06-29T12:00:00')), 0); // Monday
  assert.equal(todaySpecDay(new Date('2026-06-28T12:00:00')), 6); // Sunday
});
