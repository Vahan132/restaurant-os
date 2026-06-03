/** Subdomains reserved by the platform — never claimable as a restaurant slug. */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  'api',
  'admin',
  'pos',
  'kds',
  'www',
  'app',
  'platform',
  'dashboard',
  'auth',
  'public',
  'static',
  'assets',
  'cdn',
  'mail',
  'smtp',
  'status',
  'billing',
  'account',
  'signup',
  'login',
  'help',
  'support',
]);

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/; // 3-63 chars, no leading/trailing hyphen

/** Validate slug FORMAT only. Returns a reason string when invalid, else null. */
export function slugFormatReason(slug: string): string | null {
  if (!slug || slug.length < 3 || slug.length > 63) {
    return 'Slug must be 3–63 characters.';
  }
  if (!SLUG_RE.test(slug)) {
    return 'Use lowercase letters, digits and hyphens (no leading/trailing hyphen).';
  }
  if (RESERVED_SUBDOMAINS.has(slug)) {
    return 'This subdomain is reserved.';
  }
  return null;
}
