import { openPin, sealPin } from './device-secret.util';

describe('sealPin / openPin (PIN-VIEW-1)', () => {
  it('round-trips with the same restaurant key', () => {
    const sealed = sealPin('key-a', '482913');
    expect(sealed.startsWith('v1.')).toBe(true);
    expect(sealed).not.toContain('482913');
    expect(openPin('key-a', sealed)).toBe('482913');
  });

  it('returns null for another key, garbage or absent input', () => {
    const sealed = sealPin('key-a', '111111');
    expect(openPin('key-b', sealed)).toBeNull();
    expect(openPin('key-a', 'nope')).toBeNull();
    expect(openPin('key-a', null)).toBeNull();
  });
});
