import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import { fiscalConfigToWire } from '../../../../shared/edge/contracts/fiscal-sync.mapper';
import { FiscalCryptoService } from './fiscal-crypto.service';

/**
 * EDGE-KEK-1 — per-hub KEK re-wrap crux. Proves the blast-radius containment:
 *  - the cloud re-wraps a row DEK from the master KEK to a per-hub KEK WITHOUT
 *    ever decrypting the secrets sealed under the DEK,
 *  - the hub recovers cert/key/device-password using ONLY its own per-hub KEK,
 *  - a hub with the wrong per-hub KEK fails CLOSED at GCM verify (no plaintext),
 *  - two hubs get different keys and cannot decrypt each other's rows,
 *  - the per-hub KEK never rides in the fiscal sync payload.
 */

const MASTER_KEK = 'a'.repeat(64); // cloud master KEK (32-byte hex) — never leaves cloud

/** A FiscalCryptoService whose FISCAL_MASTER_KEK slot holds `kek`. */
function crypto(kek: string): FiscalCryptoService {
  const config = {
    get: (k: string) => (k === 'FISCAL_MASTER_KEK' ? kek : undefined),
  } as unknown as ConfigService<AppConfig, true>;
  return new FiscalCryptoService(config);
}

describe('FiscalCryptoService — per-hub KEK re-wrap (EDGE-KEK-1)', () => {
  it('re-wraps a DEK to a hub KEK and the hub opens cert/key/pwd — cloud never decrypts secrets', () => {
    const cloud = crypto(MASTER_KEK);

    // Cloud at-rest: one DEK seals cert/key/device-pwd; the DEK is master-wrapped.
    const dek = cloud.generateDek();
    const cert = cloud.sealUnderDek(dek, Buffer.from('CERT-PEM'));
    const key = cloud.sealUnderDek(dek, Buffer.from('KEY-PEM'));
    const pwd = cloud.sealUnderDek(dek, Buffer.from('device-secret'));
    const masterWrappedDek = cloud.wrapDek(dek);

    // Pairing (cloud side): a per-hub KEK, stored wrapped under the master KEK.
    const hubKek = cloud.generateHubKek();
    const wrappedHubKek = cloud.wrapHubKek(hubKek);

    // Sync emit: unwrap the hub KEK (master), re-wrap the DEK to it. The secrets
    // (cert/key/pwd) are NOT passed to re-wrap — they are never decrypted here.
    const hubKekAtEmit = cloud.unwrapHubKek(wrappedHubKek);
    const reWrappedDek = cloud.rewrapDekForHub(masterWrappedDek, hubKekAtEmit);

    // Hub side: its FISCAL_MASTER_KEK slot holds the per-hub KEK (delivered at pairing).
    const hub = crypto(hubKek.toString('hex'));
    const dekOnHub = hub.unwrapDek(reWrappedDek);
    expect(hub.openUnderDek(dekOnHub, cert).toString()).toBe('CERT-PEM');
    expect(hub.openUnderDek(dekOnHub, key).toString()).toBe('KEY-PEM');
    expect(hub.openUnderDek(dekOnHub, pwd).toString()).toBe('device-secret');
  });

  it('a hub with the WRONG per-hub KEK fails closed at GCM verify (no plaintext)', () => {
    const cloud = crypto(MASTER_KEK);
    const dek = cloud.generateDek();
    const masterWrappedDek = cloud.wrapDek(dek);

    const hubKek = cloud.generateHubKek();
    const reWrappedDek = cloud.rewrapDekForHub(masterWrappedDek, hubKek);

    // A different hub key cannot open the re-wrapped DEK.
    const wrongHub = crypto(cloud.generateHubKek().toString('hex'));
    expect(() => wrongHub.unwrapDek(reWrappedDek)).toThrow();
  });

  it('two hubs get DIFFERENT keys and cannot decrypt each other rows (blast-radius containment)', () => {
    const cloud = crypto(MASTER_KEK);
    const dek = cloud.generateDek();
    const secret = cloud.sealUnderDek(dek, Buffer.from('branch-A-cert'));
    const masterWrappedDek = cloud.wrapDek(dek);

    const kekA = cloud.generateHubKek();
    const kekB = cloud.generateHubKek();
    expect(kekA.equals(kekB)).toBe(false);

    const dekForA = cloud.rewrapDekForHub(masterWrappedDek, kekA);

    // Hub A opens its own row.
    const hubA = crypto(kekA.toString('hex'));
    expect(hubA.openUnderDek(hubA.unwrapDek(dekForA), secret).toString()).toBe('branch-A-cert');

    // Hub B — a stolen/compromised neighbour — cannot unwrap A's DEK at all.
    const hubB = crypto(kekB.toString('hex'));
    expect(() => hubB.unwrapDek(dekForA)).toThrow();
  });

  it('the per-hub KEK never appears in the fiscal sync payload', () => {
    const cloud = crypto(MASTER_KEK);
    const dek = cloud.generateDek();
    const masterWrappedDek = cloud.wrapDek(dek);
    const hubKek = cloud.generateHubKek();
    const reWrappedDek = cloud.rewrapDekForHub(masterWrappedDek, hubKek);

    // A minimal FiscalConfig-shaped row carrying the re-wrapped DEK envelope.
    const row = {
      id: 'fc1',
      restaurantId: 'r1',
      branchId: 'b1',
      dekCipher: reWrappedDek.cipher,
      dekIv: reWrappedDek.iv,
      dekAuthTag: reWrappedDek.authTag,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Parameters<typeof fiscalConfigToWire>[0];

    const wire = fiscalConfigToWire(row);
    const blob = JSON.stringify(wire);
    // Structurally there is no KEK field on FiscalConfig, and the raw key bytes
    // (base64) never appear in the serialized wire.
    expect(Object.keys(wire).some((k) => /kek/i.test(k))).toBe(false);
    expect(blob.includes(hubKek.toString('base64'))).toBe(false);
  });
});
