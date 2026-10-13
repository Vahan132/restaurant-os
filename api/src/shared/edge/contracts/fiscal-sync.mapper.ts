import type { FiscalConfig } from '@prisma/client';
import type { Jsonify } from './snapshot.contract';

/**
 * FISCAL-EDGE-1 — wire mapping for the FiscalConfig row on the cloud→edge sync.
 *
 * FiscalConfig carries ENVELOPE-ENCRYPTED bytea columns (cert/key/dek + the
 * device password) that must travel to the hub UNCHANGED (the cloud never
 * decrypts them — the hub decrypts locally with its own FISCAL_MASTER_KEK).
 * `Bytes`/`Buffer` has no native JSON form, so the bytea columns are base64
 * strings on the wire and converted back to `Buffer` when the edge applies them.
 * Everything else is serialized exactly like every other synced row (Date -> ISO).
 */
export const FISCAL_CONFIG_BYTEA_COLUMNS = [
  'certCipher',
  'certIv',
  'certAuthTag',
  'keyCipher',
  'keyIv',
  'keyAuthTag',
  'dekCipher',
  'dekIv',
  'dekAuthTag',
  'devicePwdCipher',
  'devicePwdIv',
  'devicePwdAuthTag',
] as const;

type FiscalConfigByteaColumn = (typeof FISCAL_CONFIG_BYTEA_COLUMNS)[number];

const BYTEA_SET: ReadonlySet<string> = new Set(FISCAL_CONFIG_BYTEA_COLUMNS);

/**
 * Wire form of a FiscalConfig row: the bytea columns are base64 strings (or null),
 * Dates are ISO strings. Ids and scalars are preserved verbatim (the edge mirrors
 * cloud ids exactly).
 */
export type FiscalConfigWire = Omit<Jsonify<FiscalConfig>, FiscalConfigByteaColumn> &
  Record<FiscalConfigByteaColumn, string | null>;

/** Cloud→wire: base64-encode the encrypted bytea columns, ISO-encode Dates. */
export function fiscalConfigToWire(row: FiscalConfig): FiscalConfigWire {
  const wire: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (BYTEA_SET.has(key)) {
      wire[key] = value == null ? null : (value as Buffer).toString('base64');
    } else if (value instanceof Date) {
      wire[key] = value.toISOString();
    } else {
      wire[key] = value;
    }
  }
  return wire as FiscalConfigWire;
}

/**
 * Wire→edge: decode the base64 bytea columns back to `Buffer` so Prisma stores
 * the ciphertext bytes verbatim. Dates stay ISO strings (Prisma accepts them).
 * The returned object is shaped for a FiscalConfig upsert (create/update) input.
 */
export function fiscalConfigFromWire(wire: FiscalConfigWire): Record<string, unknown> {
  const row: Record<string, unknown> = { ...wire };
  for (const col of FISCAL_CONFIG_BYTEA_COLUMNS) {
    const b64 = wire[col];
    row[col] = b64 == null ? null : Buffer.from(b64, 'base64');
  }
  return row;
}
