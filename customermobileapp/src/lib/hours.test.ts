import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayHours, jsDayToSpecDay, type WeeklyHour } from './hours';

const week: WeeklyHour[] = Array.from({ length: 7 }, (_, d) => ({
  dayOfWeek: d, // 0=Mon..6=Sun
  isClosed: d === 6, // Sunday closed
  opensAt: d === 6 ? null : '09:00',
  closesAt: d === 6 ? null : d === 4 ? '02:00' : '22:00', // Friday crosses midnight
  crossesMidnight: d === 4,
}));

test('jsDayToSpecDay maps Sunday(0)->6 and Monday(1)->0', () => {
  assert.equal(jsDayToSpecDay(0), 6); // JS Sunday -> spec 6
  assert.equal(jsDayToSpecDay(1), 0); // JS Monday -> spec 0
  assert.equal(jsDayToSpecDay(6), 5); // JS Saturday -> spec 5
});

test('todayHours returns the row for the device weekday', () => {
  // 2026-06-29 is a Monday -> spec day 0
  const monday = new Date('2026-06-29T12:00:00');
  const row = todayHours(week, monday);
  assert.ok(row);
  assert.equal(row?.dayOfWeek, 0);
  assert.equal(row?.opensAt, '09:00');
});

test('todayHours carries crossesMidnight (Friday)', () => {
  const friday = new Date('2026-07-03T12:00:00'); // Friday -> spec day 4
  const row = todayHours(week, friday);
  assert.equal(row?.dayOfWeek, 4);
  assert.equal(row?.crossesMidnight, true);
  assert.equal(row?.closesAt, '02:00');
});

test('todayHours returns null when no row matches or list empty', () => {
  assert.equal(todayHours([], new Date()), null);
  assert.equal(todayHours(null, new Date()), null);
  const onlyMonday = [week[0]];
  const sunday = new Date('2026-06-28T12:00:00'); // Sunday -> spec 6, not present
  assert.equal(todayHours(onlyMonday, sunday), null);
});
