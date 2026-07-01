/**
 * Defensive view of the backend `completeness` gate.
 *
 * The generated type is `CompletenessResponse` (`{ isComplete, missing }`), but
 * the field is serialized loosely server-side and must not be trusted at
 * runtime — read it through this adapter, never off the raw response.
 */
export interface Completeness {
  isComplete: boolean;
  /** Stable missing-field keys (e.g. `restaurant.name`, `branch.address`). */
  missing: string[];
}

/** Coerce the loosely-typed `completeness` payload into a safe shape. */
export function parseCompleteness(raw: unknown): Completeness {
  if (!raw || typeof raw !== 'object') {
    return { isComplete: false, missing: [] };
  }
  const r = raw as Record<string, unknown>;

  // Accept a few plausible spellings without trusting the generated type.
  const completeRaw = r.isComplete ?? r.complete ?? r.ready;
  const missingRaw = r.missing ?? r.missingFields ?? r.missingKeys;

  const missing = Array.isArray(missingRaw)
    ? missingRaw.filter((m): m is string => typeof m === 'string')
    : [];

  // If the flag is absent, fall back to "complete when nothing is missing".
  const isComplete =
    typeof completeRaw === 'boolean' ? completeRaw : missing.length === 0;

  return { isComplete, missing };
}

/**
 * Canonical readiness items rendered near the listed toggle. Each maps to a
 * stable backend missing-key and an i18n label key under `consumerListing`.
 * Items the backend reports as missing but that aren't listed here are still
 * surfaced (humanized) by the checklist, so this list never hides a gap.
 */
export const READINESS_ITEMS: { key: string; labelKey: string }[] = [
  { key: 'restaurant.name', labelKey: 'check.name' },
  { key: 'restaurant.logo', labelKey: 'check.logo' },
  { key: 'restaurant.photos', labelKey: 'check.photos' },
  { key: 'restaurant.about', labelKey: 'check.about' },
  { key: 'branch.address', labelKey: 'check.address' },
];

const KNOWN_KEYS = new Set(READINESS_ITEMS.map((i) => i.key));

/** Missing keys the backend reported that aren't in our canonical list. */
export function extraMissing(missing: string[]): string[] {
  return missing.filter((m) => !KNOWN_KEYS.has(m));
}

/** Turn an unknown key like `branch.opening_hours` into "Branch opening hours". */
export function humanizeKey(key: string): string {
  const words = key.replace(/[._-]+/g, ' ').trim().split(/\s+/);
  if (words.length === 0) return key;
  return words
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}
