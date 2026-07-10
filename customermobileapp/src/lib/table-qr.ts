/**
 * table-qr — parse a scanned table QR into its ordering coordinates.
 *
 * ORDER-4: table QR codes encode a storefront URL carrying the restaurant slug and the
 * table identifier `qr`, e.g.
 *     https://host/res/m/<restaurantSlug>?...&qr=<table>
 *     https://host/public/<restaurantSlug>/branch/<branchSlug>/menu?qr=<table>
 * We need `restaurantSlug` + the `qr` value; `branchSlug` is a bonus (the authoritative
 * branch is resolved server-side via GET /public/table?qr=). Parses DEFENSIVELY —
 * anything unrecognized returns null so the scanner can show "not a valid table code"
 * rather than crash. No `URL`/`Intl` reliance (Hermes coverage varies).
 */

export interface ScannedTable {
  restaurantSlug: string;
  /** Present when the QR path/query includes it; otherwise resolved server-side. */
  branchSlug: string | null;
  /** The scanned table identifier. */
  qr: string;
}

function parseQuery(query: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = eq >= 0 ? pair.slice(0, eq) : pair;
    const val = eq >= 0 ? pair.slice(eq + 1) : '';
    try {
      out.set(decodeURIComponent(key), decodeURIComponent(val));
    } catch {
      out.set(key, val);
    }
  }
  return out;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Parse a scanned QR string. Returns `{ restaurantSlug, branchSlug, qr }` or null if it
 * is not a recognizable table code (no `qr`, or no resolvable restaurant slug).
 */
export function parseTableQr(raw: string | null | undefined): ScannedTable | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const qIndex = trimmed.indexOf('?');
  const pathPart = qIndex >= 0 ? trimmed.slice(0, qIndex) : trimmed;
  const queryPart = qIndex >= 0 ? trimmed.slice(qIndex + 1) : '';

  // Strip scheme + host, keeping only the path (if a full URL was scanned).
  let path = pathPart;
  const schemed = /^[a-z][a-z0-9+.-]*:\/\/[^/]+(\/.*)?$/i.exec(pathPart);
  if (schemed) path = schemed[1] ?? '';

  const params = parseQuery(queryPart);
  const qr = params.get('qr') ?? '';
  if (!qr) return null;

  let restaurantSlug: string | null = null;
  let branchSlug: string | null = null;

  const publicMatch = /\/public\/([^/]+)\/branch\/([^/?]+)/i.exec(path);
  const resMatch = /\/res\/m\/([^/?]+)/i.exec(path);
  if (publicMatch) {
    restaurantSlug = safeDecode(publicMatch[1]);
    branchSlug = safeDecode(publicMatch[2]);
  } else if (resMatch) {
    restaurantSlug = safeDecode(resMatch[1]);
  }

  // Query fallbacks (e.g. ?restaurant=slug&branch=slug).
  if (!restaurantSlug) restaurantSlug = params.get('restaurant') ?? params.get('r') ?? null;
  if (!branchSlug) branchSlug = params.get('branch') ?? params.get('b') ?? null;

  if (!restaurantSlug) return null;
  return { restaurantSlug, branchSlug, qr };
}
