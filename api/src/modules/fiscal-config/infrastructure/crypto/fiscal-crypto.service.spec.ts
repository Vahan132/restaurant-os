import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import { FiscalCryptoService } from './fiscal-crypto.service';

/**
 * FISCAL-EDGE-1 shared-DEK + KEK crux. Proves:
 *  - cert/key AND the device password can share ONE per-row DEK (the model the
 *    store persists and the hub adapter reads),
 *  - the hub decrypts only when its FISCAL_MASTER_KEK matches the wrapping KEK,
 *  - a mismatched KEK fails CLOSED (throws at GCM verify, no plaintext), and
 *  - the pre-existing wrap()/unwrap() cert path is unchanged.
 */

const KEK_A = 'a'.repeat(64); // 32-byte hex
const KEK_B = 'b'.repeat(64); // a DIFFERENT master key (simulates a wrong hub KEK)

function crypto(kek: string): FiscalCryptoService {
  const config = {
    get: (k: string) => (k === 'FISCAL_MASTER_KEK' ? kek : undefined),
  } as unknown as ConfigService<AppConfig, true>;
  return new FiscalCryptoService(config);
}

describe('FiscalCryptoService — shared DEK', () => {
  it('seals cert, key and device password under one DEK and opens them all', () => {
    const c = crypto(KEK_A);
    const dek = c.generateDek();

    const cert = c.sealUnderDek(dek, Buffer.from('CERT-PEM'));
    const key = c.sealUnderDek(dek, Buffer.from('KEY-PEM'));
    const pwd = c.sealUnderDek(dek, Buffer.from('device-secret'));
    const wrappedDek = c.wrapDek(dek);

    // Hub side: recover the DEK from the wrapped blob, then open every secret.
    const recovered = c.unwrapDek(wrappedDek);
    expect(c.openUnderDek(recovered, cert).toString()).toBe('CERT-PEM');
    expect(c.openUnderDek(recovered, key).toString()).toBe('KEY-PEM');
    expect(c.openUnderDek(recovered, pwd).toString()).toBe('device-secret');
  });

  it('lets a matching KEK on a SECOND instance (the hub) decrypt the DEK', () => {
    const cloud = crypto(KEK_A);
    const dek = cloud.generateDek();
    const pwd = cloud.sealUnderDek(dek, Buffer.from('device-secret'));
    const wrappedDek = cloud.wrapDek(dek);

    const hub = crypto(KEK_A); // same master KEK → same-KEK (Option A)
    const dekOnHub = hub.unwrapDek(wrappedDek);
    expect(hub.openUnderDek(dekOnHub, pwd).toString()).toBe('device-secret');
  });

  it('fails closed when the hub KEK does not match (no plaintext leak)', () => {
    const cloud = crypto(KEK_A);
    const dek = cloud.generateDek();
    const wrappedDek = cloud.wrapDek(dek);

    const wrongHub = crypto(KEK_B);
    // GCM auth-tag verification throws; nothing is returned.
    expect(() => wrongHub.unwrapDek(wrappedDek)).toThrow();
  });

  it('keeps the existing wrap()/unwrap() cert path working', () => {
    const c = crypto(KEK_A);
    const w = c.wrap(Buffer.from('CERT-PEM'), Buffer.from('KEY-PEM'));
    const out = c.unwrap(w);
    expect(out.cert.toString()).toBe('CERT-PEM');
    expect(out.key.toString()).toBe('KEY-PEM');
  });

  it('rejects a malformed KEK at construction (fails fast, not at first decrypt)', () => {
    expect(() => crypto('not-hex')).toThrow(/64 hex/);
  });
});
