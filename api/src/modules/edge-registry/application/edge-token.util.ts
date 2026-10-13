import { createHash, randomBytes } from 'node:crypto';

/** Mint a random bearer node token (plaintext shown to the operator once). */
export function generateNodeToken(): string {
  return randomBytes(32).toString('hex');
}

/** sha256 hex of a raw node token (what gets stored / matched). */
export function hashNodeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ── EDGE-PAIR-2: human-enterable pairing codes ──────────────────────────────
// A short, single-use, branch-scoped code an admin reads out to a restaurant.
// Crockford-ish base32 WITHOUT ambiguous glyphs (no 0/O/1/I/L/U) so it's easy to
// read aloud and type. 8 chars ≈ 40 bits of entropy — plenty for a short-TTL,
// single-use, rate-limitable code. Only sha256(normalized code) is ever stored.
const PAIRING_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const PAIRING_CODE_LENGTH = 8;

/** Mint a random human-enterable pairing code (plaintext shown once). */
export function generatePairingCode(): string {
  const bytes = randomBytes(PAIRING_CODE_LENGTH);
  let out = '';
  for (let i = 0; i < PAIRING_CODE_LENGTH; i += 1) {
    out += PAIRING_CODE_ALPHABET[bytes[i] % PAIRING_CODE_ALPHABET.length];
  }
  return out;
}

/**
 * Normalize a user-entered pairing code (uppercase; strip spaces/hyphens) then
 * sha256 it — so "abcd-2345" and "ABCD 2345" match the stored hash. The plaintext
 * is never stored.
 */
export function hashPairingCode(code: string): string {
  const normalized = code.replace(/[\s-]/g, '').toUpperCase();
  return createHash('sha256').update(normalized).digest('hex');
}
