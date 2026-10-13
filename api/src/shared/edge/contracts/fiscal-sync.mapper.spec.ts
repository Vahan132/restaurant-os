import type { FiscalConfig } from '@prisma/client';
import {
  FISCAL_CONFIG_BYTEA_COLUMNS,
  fiscalConfigFromWire,
  fiscalConfigToWire,
} from './fiscal-sync.mapper';

/**
 * FISCAL-EDGE-1 wire mapper. Proves the envelope-encrypted bytea columns survive
 * the cloud→edge JSON round-trip byte-for-byte (base64), that null blobs stay
 * null, and that non-bytea scalars / Dates pass through unchanged. This is the
 * guarantee that the hub receives the SAME ciphertext the cloud stored, so its
 * KEK can decrypt it.
 */

/** A representative FiscalConfig row: cert/key/dek set, device password set. */
function makeRow(over: Partial<Record<string, unknown>> = {}): FiscalConfig {
  const buf = (s: string): Buffer => Buffer.from(s, 'utf8');
  return {
    id: 'fc_1',
    restaurantId: 'r_1',
    branchId: 'b_1',
    crn: '00123456',
    cashierId: '3',
    environment: 'TEST',
    language: 'hy',
    active: true,
    certCipher: buf('cert-cipher-\x00\x01\x02'),
    certIv: buf('cert-iv'),
    certAuthTag: buf('cert-tag'),
    keyCipher: buf('key-cipher'),
    keyIv: buf('key-iv'),
    keyAuthTag: buf('key-tag'),
    dekCipher: buf('dek-cipher'),
    dekIv: buf('dek-iv'),
    dekAuthTag: buf('dek-tag'),
    kekVersion: 1,
    deviceHost: '10.0.0.5',
    devicePort: 8443,
    devicePwdCipher: buf('pwd-cipher-\xff\xfe'),
    devicePwdIv: buf('pwd-iv'),
    devicePwdAuthTag: buf('pwd-tag'),
    fiscalPrintMode: 'MANUAL',
    lastCheckConnectionAt: new Date('2026-07-01T10:00:00.000Z'),
    lastCheckConnectionOk: true,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T10:00:00.000Z'),
    ...over,
  } as unknown as FiscalConfig;
}

/** Simulate the actual sync hop: object -> JSON string -> object. */
function overTheWire<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('fiscalConfigToWire / fiscalConfigFromWire', () => {
  it('round-trips every encrypted bytea column byte-for-byte through JSON', () => {
    const row = makeRow();
    const restored = fiscalConfigFromWire(overTheWire(fiscalConfigToWire(row)));
    for (const col of FISCAL_CONFIG_BYTEA_COLUMNS) {
      const original = (row as unknown as Record<string, Buffer>)[col];
      const back = restored[col] as Buffer;
      expect(Buffer.isBuffer(back)).toBe(true);
      expect(back.equals(original)).toBe(true);
    }
  });

  it('encodes bytea columns as base64 strings on the wire (not Buffer JSON)', () => {
    const wire = fiscalConfigToWire(makeRow());
    expect(typeof wire.certCipher).toBe('string');
    expect(wire.certCipher).toBe(Buffer.from('cert-cipher-\x00\x01\x02', 'utf8').toString('base64'));
  });

  it('preserves null blobs as null (e-HDM row with no device / no cert)', () => {
    const row = makeRow({
      certCipher: null,
      certIv: null,
      certAuthTag: null,
      keyCipher: null,
      keyIv: null,
      keyAuthTag: null,
      dekCipher: null,
      dekIv: null,
      dekAuthTag: null,
      kekVersion: null,
      deviceHost: null,
      devicePort: null,
      devicePwdCipher: null,
      devicePwdIv: null,
      devicePwdAuthTag: null,
    });
    const wire = overTheWire(fiscalConfigToWire(row));
    expect(wire.devicePwdCipher).toBeNull();
    expect(wire.deviceHost).toBeNull();
    const restored = fiscalConfigFromWire(wire);
    expect(restored.devicePwdCipher).toBeNull();
    expect(restored.certCipher).toBeNull();
  });

  it('passes non-bytea scalars through and ISO-encodes Dates', () => {
    const wire = fiscalConfigToWire(makeRow());
    expect(wire.id).toBe('fc_1');
    expect(wire.deviceHost).toBe('10.0.0.5');
    expect(wire.devicePort).toBe(8443);
    expect(wire.updatedAt).toBe('2026-07-01T10:00:00.000Z');
  });

  it('carries the FISCAL-EDGE-3 fiscalPrintMode enum across the wire for free', () => {
    const restored = fiscalConfigFromWire(overTheWire(fiscalConfigToWire(makeRow())));
    expect(restored.fiscalPrintMode).toBe('MANUAL');
  });
});
