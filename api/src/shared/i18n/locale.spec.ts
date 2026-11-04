import { isSupportedLocale, parseLocale, resolveEffectiveLocale, resolveI18n } from './locale';

describe('shared/i18n/locale', () => {
  describe('parseLocale', () => {
    it.each(['hy', 'ru', 'en'])('accepts supported locale %s', (l) => {
      expect(parseLocale(l)).toBe(l);
    });

    it('normalizes case and whitespace', () => {
      expect(parseLocale('  HY ')).toBe('hy');
      expect(parseLocale('En')).toBe('en');
    });

    it('returns null for unsupported / blank / missing', () => {
      expect(parseLocale('fr')).toBeNull();
      expect(parseLocale('')).toBeNull();
      expect(parseLocale(undefined)).toBeNull();
      expect(parseLocale(null)).toBeNull();
    });
  });

  describe('resolveEffectiveLocale (requested ?? default ?? en)', () => {
    it('prefers the guest requested locale', () => {
      expect(resolveEffectiveLocale('hy', 'ru')).toBe('hy');
    });

    it('falls back to the restaurant default when no request', () => {
      expect(resolveEffectiveLocale(null, 'ru')).toBe('ru');
    });

    it('falls back to en when neither is valid', () => {
      expect(resolveEffectiveLocale(null, 'fr')).toBe('en');
      expect(resolveEffectiveLocale(null, null)).toBe('en');
    });

    it('validates the restaurant default too (an unsupported default never leaks)', () => {
      expect(resolveEffectiveLocale(null, 'de')).toBe('en');
    });
  });

  describe('resolveI18n (LOCALE-2B: translation(locale) ?? primary)', () => {
    it('returns the translation in the requested locale when present', () => {
      const name = { hy: 'name-hy', ru: 'name-ru', en: null };
      expect(resolveI18n('ru', name, 'Primary')).toBe('name-ru');
      expect(resolveI18n('hy', name, 'Primary')).toBe('name-hy');
    });

    it('falls back to the primary when that locale has no translation', () => {
      const name = { hy: 'name-hy', ru: null, en: null };
      expect(resolveI18n('en', name, 'Primary')).toBe('Primary'); // en missing
      expect(resolveI18n('ru', name, 'Primary')).toBe('Primary'); // ru null
    });

    it('a null primary with no translation stays null (nullable descriptions)', () => {
      const desc = { hy: null, ru: null, en: null };
      expect(resolveI18n('ru', desc, null)).toBeNull();
    });

    it('resolves a description translation over a null primary', () => {
      const desc = { hy: null, ru: 'desc-ru', en: null };
      expect(resolveI18n('ru', desc, null)).toBe('desc-ru');
    });
  });

  it('isSupportedLocale is a correct type guard', () => {
    expect(isSupportedLocale('hy')).toBe(true);
    expect(isSupportedLocale('fr')).toBe(false);
    expect(isSupportedLocale(42)).toBe(false);
  });
});
