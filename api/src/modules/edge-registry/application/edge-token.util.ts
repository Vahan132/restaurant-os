import { createHash, randomBytes } from 'node:crypto';

/** Mint a random bearer node token (plaintext shown to the operator once). */
export function generateNodeToken(): string {
  return randomBytes(32).toString('hex');
}

/** sha256 hex of a raw node token (what gets stored / matched). */
export function hashNodeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
