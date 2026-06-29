import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';

/**
 * Device secret + PIN cryptographic helpers (3A).
 *
 * - Device secrets are HIGH-ENTROPY random tokens, so a fast deterministic hash
 *   (sha256) is appropriate and lets us look them up O(1) at login (mirrors the
 *   existing CallDevice.tokenHash pattern).
 * - PINs are LOW-ENTROPY (6 digits); they are hashed with argon2 for VERIFICATION
 *   (see Argon2PasswordHasher). The keyed `pinFingerprint` below is a separate,
 *   non-reversible value used ONLY to enforce active-PIN uniqueness within a
 *   restaurant — it is keyed with the per-restaurant signing key so it cannot be
 *   brute-forced or correlated across restaurants.
 */

/** Generate a high-entropy device secret (returned to the operator once). */
export function generateDeviceSecret(): string {
  return randomBytes(32).toString('hex');
}

/** sha256 hex digest of a device secret (what gets stored / matched). */
export function hashDeviceSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

/** Generate a uniformly-random 6-digit PIN ("000000".."999999"). */
export function generatePin(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * Keyed fingerprint of a PIN, scoped to a restaurant via its signing key. Used
 * solely for the active-PIN uniqueness constraint; never reveals the PIN.
 */
export function pinFingerprint(restaurantSigningKey: string, pin: string): string {
  return createHmac('sha256', restaurantSigningKey).update(`pin:${pin}`).digest('hex');
}

/**
 * Derive a coarse CIDR from a client IP for the enrollment record (IPv4 -> /24,
 * IPv6 -> /64). Best-effort; returns null for unrecognized input. Strips an IPv4-
 * mapped IPv6 prefix ("::ffff:1.2.3.4").
 */
export function deriveCidr(ip: string | null | undefined): string | null {
  if (!ip) {
    return null;
  }
  const cleaned = ip.replace(/^::ffff:/i, '').trim();
  // IPv4
  const v4 = cleaned.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (v4) {
    return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`;
  }
  // IPv6 (take the first four hextets as the /64 network).
  if (cleaned.includes(':')) {
    const groups = cleaned.split(':').filter((g) => g.length > 0);
    if (groups.length >= 4) {
      return `${groups.slice(0, 4).join(':')}::/64`;
    }
  }
  return null;
}
