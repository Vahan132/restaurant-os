/**
 * Minimal IP-allowlist matcher for branch IP policy (3A, STRICT mode).
 *
 * Supports IPv4 CIDRs and bare IPv4 addresses (treated as /32) with full mask
 * arithmetic. IPv6 entries are matched by normalized exact equality or exact
 * prefix string (best-effort) — STRICT IPv6 deployments should list explicit
 * addresses. An empty allowlist matches nothing.
 */

function stripMapped(ip: string): string {
  return ip
    .replace(/^::ffff:/i, '')
    .trim()
    .toLowerCase();
}

function ipv4ToInt(ip: string): number | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) {
    return null;
  }
  const octets = m.slice(1, 5).map(Number);
  if (octets.some((o) => o < 0 || o > 255)) {
    return null;
  }
  return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
}

function matchEntry(ip: string, entry: string): boolean {
  const cleanedIp = stripMapped(ip);
  const cleanedEntry = entry.trim().toLowerCase();
  if (cleanedEntry.length === 0) {
    return false;
  }

  const [net, bitsRaw] = cleanedEntry.split('/');
  const ipInt = ipv4ToInt(cleanedIp);
  const netInt = ipv4ToInt(net);

  if (ipInt !== null && netInt !== null) {
    // IPv4 (CIDR or bare /32).
    const bits = bitsRaw === undefined ? 32 : Number(bitsRaw);
    if (!Number.isInteger(bits) || bits < 0 || bits > 32) {
      return false;
    }
    if (bits === 0) {
      return true;
    }
    const mask = bits === 32 ? 0xffffffff : (~(0xffffffff >>> bits) & 0xffffffff) >>> 0;
    return (ipInt & mask) === (netInt & mask);
  }

  // IPv6 (or mismatched families): exact match, or prefix-string match for a
  // listed "<prefix>::/n" against a normalized address.
  if (bitsRaw === undefined) {
    return cleanedIp === net;
  }
  const prefix = net.replace(/::$/, '');
  return cleanedIp === net || cleanedIp.startsWith(prefix);
}

/** True if `ip` matches any CIDR/address in `allowlist`. */
export function ipMatchesAllowlist(ip: string | null | undefined, allowlist: string[]): boolean {
  if (!ip || allowlist.length === 0) {
    return false;
  }
  return allowlist.some((entry) => matchEntry(ip, entry));
}
