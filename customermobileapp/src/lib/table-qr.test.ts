import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTableQr } from './table-qr';

test('parses /res/m/<slug>?qr= form', () => {
  const r = parseTableQr('https://order.example.com/res/m/bistro?lang=hy&qr=T12');
  assert.deepEqual(r, { restaurantSlug: 'bistro', branchSlug: null, qr: 'T12' });
});

test('parses storefront branch path with qr', () => {
  const r = parseTableQr('https://x.io/public/bistro/branch/downtown/menu?qr=A4');
  assert.deepEqual(r, { restaurantSlug: 'bistro', branchSlug: 'downtown', qr: 'A4' });
});

test('parses a bare path without scheme/host', () => {
  const r = parseTableQr('/res/m/cafe?qr=5');
  assert.deepEqual(r, { restaurantSlug: 'cafe', branchSlug: null, qr: '5' });
});

test('query-param fallback for slugs', () => {
  const r = parseTableQr('myapp://order?restaurant=bistro&branch=uptown&qr=9');
  assert.deepEqual(r, { restaurantSlug: 'bistro', branchSlug: 'uptown', qr: '9' });
});

test('returns null without a qr', () => {
  assert.equal(parseTableQr('https://x.io/res/m/bistro'), null);
});

test('returns null without a resolvable restaurant slug', () => {
  assert.equal(parseTableQr('https://x.io/somewhere?qr=1'), null);
});

test('returns null for empty / junk', () => {
  assert.equal(parseTableQr(''), null);
  assert.equal(parseTableQr(null), null);
  assert.equal(parseTableQr('not a url'), null);
});
