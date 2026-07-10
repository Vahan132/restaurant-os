import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatMoney, formatPriceDelta, minorExponent } from './money';

test('minorExponent: 2 for standard currencies, 0 for zero-decimal', () => {
  assert.equal(minorExponent('USD'), 2);
  assert.equal(minorExponent('amd'), 2);
  assert.equal(minorExponent('JPY'), 0);
  assert.equal(minorExponent('krw'), 0);
});

test('formatMoney: 2-decimal currencies', () => {
  assert.equal(formatMoney(1500, 'USD'), '15.00 USD');
  assert.equal(formatMoney(5, 'USD'), '0.05 USD');
  assert.equal(formatMoney(0, 'USD'), '0.00 USD');
  assert.equal(formatMoney(123456789, 'USD'), '1,234,567.89 USD');
});

test('formatMoney: zero-decimal currencies have no fraction', () => {
  assert.equal(formatMoney(1500, 'JPY'), '1,500 JPY');
  assert.equal(formatMoney(0, 'JPY'), '0 JPY');
});

test('formatMoney: negatives', () => {
  assert.equal(formatMoney(-2599, 'USD'), '-25.99 USD');
});

test('formatMoney: rounds non-integer input defensively', () => {
  assert.equal(formatMoney(1500.4, 'USD'), '15.00 USD');
});

test('formatPriceDelta: explicit sign for non-zero', () => {
  assert.equal(formatPriceDelta(250, 'USD'), '+2.50 USD');
  assert.equal(formatPriceDelta(-250, 'USD'), '-2.50 USD');
  assert.equal(formatPriceDelta(0, 'USD'), '0.00 USD');
});
