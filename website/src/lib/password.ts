/** Lightweight password strength heuristic for the signup / reset hints. */
export type PasswordScore = 0 | 1 | 2 | 3 | 4;

/**
 * Returns a 0–4 strength score. The human-readable label is resolved by the
 * component from the catalog (`auth.passwordStrength.<score>`), keeping this
 * helper locale-agnostic.
 */
export function scorePassword(pw: string): { score: PasswordScore } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const clamped = Math.min(score, 4) as PasswordScore;
  return { score: clamped };
}
