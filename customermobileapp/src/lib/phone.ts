/**
 * Light E.164 normalization (mirrors the backend's E164Phone.normalize): strip
 * spaces/dashes/parens, convert a leading 00 → +. Validation is the server's job;
 * this just produces a clean candidate to send.
 */
export function normalizeE164(raw: string): string {
  let s = (raw ?? '').trim().replace(/[\s\-().]/g, '');
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  return s;
}

/** Loose check used only to enable/disable the "send code" button. */
export function looksLikeE164(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(normalizeE164(value));
}
