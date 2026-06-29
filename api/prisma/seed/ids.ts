/**
 * SEED-1 deterministic identity (locked decision A).
 *
 * Every seeded row gets a STABLE id derived from a human slug via uuidv5, so:
 *   - cross-references between phases are stable (no random ids in config),
 *   - a re-run upserts the SAME rows (identical ids), and
 *   - reset can find seed-owned rows by their deterministic ids.
 *
 * uuidv5 is implemented locally (RFC 4122, SHA-1) to avoid adding a runtime
 * dependency — the repo ships @paralleldrive/cuid2 but not `uuid`.
 *
 * NOTE: rows created through the REAL use-cases (goods receipts, stock layers +
 * movements, orders + items + payments, staff PINs, enrolled devices, process
 * runs) are assigned cuid ids by the application's own ID_GENERATOR — by design
 * (locked decision B routes invariant-bearing writes through the real path).
 * Those ids therefore differ between runs; idempotency for them is achieved by
 * wipe-seed-owned-then-reseed (decision C), which yields identical COUNTS and
 * identical inventory VALUATION on every run.
 */
import { createHash } from 'crypto';

/** Fixed namespace UUID for this seed. Never change it — ids derive from it. */
export const SEED_NAMESPACE = '6f9619ff-8b86-d011-b42d-00cf4fc964ff';

/** Marker stamped on the sentinel + used to scope reset. */
export const SEED_VERSION = 'SEED-1';

function parseUuidToBytes(uuid: string): Buffer {
  const hex = uuid.replace(/[^0-9a-fA-F]/g, '');
  if (hex.length !== 32) {
    throw new Error(`Invalid namespace UUID: ${uuid}`);
  }
  return Buffer.from(hex, 'hex');
}

function bytesToUuid(bytes: Buffer): string {
  const h = bytes.toString('hex');
  return (
    `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-` +
    `${h.slice(16, 20)}-${h.slice(20, 32)}`
  );
}

const NAMESPACE_BYTES = parseUuidToBytes(SEED_NAMESPACE);

/** Deterministic uuidv5(slug, SEED_NAMESPACE). Stable across runs and machines. */
export function seedId(slug: string): string {
  const hash = createHash('sha1')
    .update(NAMESPACE_BYTES)
    .update(Buffer.from(slug, 'utf8'))
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  return bytesToUuid(bytes);
}
