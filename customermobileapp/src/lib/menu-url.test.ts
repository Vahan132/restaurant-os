import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMenuUrl } from './menu-url';

test('parses the canonical storefront menu path', () => {
  assert.deepEqual(parseMenuUrl('/public/acme/branch/downtown/menu'), {
    restaurantSlug: 'acme',
    branchSlug: 'downtown',
  });
});

test('tolerates a missing leading slash and a trailing slash', () => {
  assert.deepEqual(parseMenuUrl('public/acme/branch/downtown/menu/'), {
    restaurantSlug: 'acme',
    branchSlug: 'downtown',
  });
});

test('decodes percent-encoded slugs', () => {
  assert.deepEqual(parseMenuUrl('/public/caf%C3%A9/branch/near%20me/menu'), {
    restaurantSlug: 'café',
    branchSlug: 'near me',
  });
});

test('returns null for null / empty / malformed input', () => {
  assert.equal(parseMenuUrl(null), null);
  assert.equal(parseMenuUrl(undefined), null);
  assert.equal(parseMenuUrl(''), null);
  assert.equal(parseMenuUrl('/public/acme/menu'), null);
  assert.equal(parseMenuUrl('/public/acme/branch//menu'), null);
  assert.equal(parseMenuUrl('https://x.com/other/path'), null);
});
