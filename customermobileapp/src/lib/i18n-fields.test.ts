import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickI18n, pickLabel } from './i18n-fields';

test('pickI18n returns active locale when present', () => {
  assert.equal(pickI18n({ hy: 'Բարև', ru: 'Привет', en: 'Hello' }, 'ru'), 'Привет');
  assert.equal(pickI18n({ hy: 'Բարև', ru: 'Привет', en: 'Hello' }, 'en'), 'Hello');
});

test('pickI18n falls back active -> hy -> ru -> en', () => {
  // active (ru) empty -> hy
  assert.equal(pickI18n({ hy: 'Բարև', ru: null, en: 'Hello' }, 'ru'), 'Բարև');
  // active (en) empty, hy empty -> ru
  assert.equal(pickI18n({ hy: null, ru: 'Привет', en: '' }, 'en'), 'Привет');
  // only en present, active hy -> en
  assert.equal(pickI18n({ hy: null, ru: null, en: 'Hello' }, 'hy'), 'Hello');
});

test('pickI18n returns empty string when nothing present or field nullish', () => {
  assert.equal(pickI18n({ hy: null, ru: null, en: null }, 'hy'), '');
  assert.equal(pickI18n(null, 'hy'), '');
  assert.equal(pickI18n(undefined, 'en'), '');
});

test('pickLabel resolves labelHy/labelRu/labelEn with same fallback', () => {
  const cat = { labelHy: 'Խոհանոց', labelRu: 'Кухня', labelEn: 'Cuisine' };
  assert.equal(pickLabel(cat, 'en'), 'Cuisine');
  assert.equal(pickLabel(cat, 'hy'), 'Խոհանոց');
  // active ru missing -> hy
  assert.equal(pickLabel({ labelHy: 'Խոհանոց', labelRu: null, labelEn: 'Cuisine' }, 'ru'), 'Խոհանոց');
  assert.equal(pickLabel(null, 'hy'), '');
});
