/**
 * Offline verification for the FISCAL-4 fiscal-config store (no DB / no SRC).
 * Exercises: envelope crypto round-trip, KEK boot validation, the DB adapter's
 * decrypt + departmentMap mapping (fake Prisma), and the `dep` wiring in the
 * e-HDM payload builder.
 *
 *   pnpm run verify:fiscal-config      (ts-node --transpile-only)
 */
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { FiscalCryptoService } from '../src/modules/fiscal-config/infrastructure/crypto/fiscal-crypto.service';
import { DbFiscalConfigAdapter } from '../src/modules/fiscal-config/infrastructure/adapters/db-fiscal-config.adapter';
import {
  buildPrintPayload,
} from '../src/modules/fiscalization/application/ehdm-protocol';
import {
  FiscalizationInput,
  FiscalMode,
} from '../src/modules/fiscalization/application/ports/fiscalization.port';
import { TenantFiscalConfig } from '../src/modules/fiscalization/application/ports/fiscal-config.port';

let passed = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    console.error(`  FAIL  ${name}\n        ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

const KEK = 'a'.repeat(64); // 32 bytes hex
const fakeConfig = (over: Record<string, unknown> = {}) =>
  ({
    get: (k: string) =>
      ({ FISCAL_MASTER_KEK: KEK, FISCAL_CONFIG_BACKEND: 'DB', ...over } as Record<string, unknown>)[k],
  }) as unknown as import('@nestjs/config').ConfigService<never, true>;

const CERT = '-----BEGIN CERTIFICATE-----\nCERT-BODY\n-----END CERTIFICATE-----';
const KEY = '-----BEGIN PRIVATE KEY-----\nKEY-BODY\n-----END PRIVATE KEY-----';

// 1. Envelope crypto round-trip
check('crypto: wrap then unwrap recovers cert + key', () => {
  const c = new FiscalCryptoService(fakeConfig());
  const w = c.wrap(Buffer.from(CERT), Buffer.from(KEY));
  // Ciphertext must differ from plaintext and the DEK is wrapped separately.
  assert.notStrictEqual(w.cert.cipher.toString('utf8'), CERT);
  assert.ok(w.dek.cipher.length > 0);
  const out = c.unwrap(w);
  assert.strictEqual(out.cert.toString('utf8'), CERT);
  assert.strictEqual(out.key.toString('utf8'), KEY);
});

check('crypto: two wraps use different DEKs (ciphertext differs)', () => {
  const c = new FiscalCryptoService(fakeConfig());
  const a = c.wrap(Buffer.from(CERT), Buffer.from(KEY));
  const b = c.wrap(Buffer.from(CERT), Buffer.from(KEY));
  assert.notStrictEqual(a.cert.cipher.toString('hex'), b.cert.cipher.toString('hex'));
});

check('crypto: tampered auth tag fails decryption (GCM integrity)', () => {
  const c = new FiscalCryptoService(fakeConfig());
  const w = c.wrap(Buffer.from(CERT), Buffer.from(KEY));
  w.cert.authTag[0] ^= 0xff;
  assert.throws(() => c.unwrap(w));
});

// 2. KEK boot validation
check('crypto: malformed KEK throws at construction (not first decrypt)', () => {
  assert.throws(() => new FiscalCryptoService(fakeConfig({ FISCAL_MASTER_KEK: 'nothex' })));
});
check('crypto: missing KEK -> isConfigured false + throws on use', () => {
  const c = new FiscalCryptoService(fakeConfig({ FISCAL_MASTER_KEK: undefined }));
  assert.strictEqual(c.isConfigured, false);
  assert.throws(() => c.wrap(Buffer.from(CERT), Buffer.from(KEY)));
});

// 3. dep wiring in buildPrintPayload
function baseInput(over: Partial<FiscalizationInput> = {}): FiscalizationInput {
  return {
    restaurantId: 'r', branchId: 'b', orderRef: 'o', currency: 'AMD',
    channel: 'QR_WEB', mode: FiscalMode.PRODUCTS, partnerTin: null,
    lines: [{
      name: 'X', goodName: 'X', goodCode: 'x', quantityThousandths: 1000,
      unit: 'pcs', unitPriceAmount: 1000, lineTotalAmount: 1000,
      adgCode: '2130000000', dep: null,
    }],
    subtotalAmount: 1000, discountAmount: 0, serviceFeeAmount: 0, totalAmount: 1000,
    cardAmount: 1000, cashAmount: 0, partialAmount: 0, prePaymentAmount: 0, changeAmount: 0,
    ...over,
  };
}
const cfgWith = (departmentMap: Record<string, string>): TenantFiscalConfig => ({
  crn: '1', cashierId: 'c', environment: 'TEST', baseUrl: 'https://10.3.14.123:447',
  clientCert: 'x', clientKey: 'y', caRoot: 'z', language: 'hy', departmentMap,
});

check('payload: null-dep line takes the tenant default dep from the map', () => {
  const p = buildPrintPayload(baseInput(), cfgWith({ '01': 'regime-a' }));
  assert.strictEqual(p.items[0].dep, '01');
});
check('payload: lowest dep code chosen deterministically when several', () => {
  const p = buildPrintPayload(baseInput(), cfgWith({ '05': 'e', '02': 'b', '09': 'i' }));
  assert.strictEqual(p.items[0].dep, '02');
});
check('payload: empty department map leaves dep null (no crash)', () => {
  const p = buildPrintPayload(baseInput(), cfgWith({}));
  assert.strictEqual(p.items[0].dep, null);
});
check('payload: explicit line dep is preserved over the default', () => {
  const input = baseInput({
    lines: [{
      name: 'X', goodName: 'X', goodCode: 'x', quantityThousandths: 1000, unit: 'pcs',
      unitPriceAmount: 1000, lineTotalAmount: 1000, adgCode: '2130000000', dep: '07',
    }],
  });
  const p = buildPrintPayload(input, cfgWith({ '01': 'a' }));
  assert.strictEqual(p.items[0].dep, '07');
});

// 4. DB adapter mapping (fake Prisma + temp CA file)
async function run(): Promise<void> {
  const caPath = path.join(os.tmpdir(), `fiscal-ca-${Date.now()}.pem`);
  fs.writeFileSync(caPath, 'CA-PEM-BODY');
  const cfg = fakeConfig({ FISCAL_SRC_CA_PATH: caPath });
  const cipher = new FiscalCryptoService(cfg);
  const w = cipher.wrap(Buffer.from(CERT), Buffer.from(KEY));
  const row = {
    crn: '12345678', cashierId: 'CASH-1', environment: 'TEST', language: 'hy', active: true,
    certCipher: w.cert.cipher, certIv: w.cert.iv, certAuthTag: w.cert.authTag,
    keyCipher: w.key.cipher, keyIv: w.key.iv, keyAuthTag: w.key.authTag,
    dekCipher: w.dek.cipher, dekIv: w.dek.iv, dekAuthTag: w.dek.authTag, kekVersion: w.kekVersion,
    departments: [{ dep: '01', taxRegime: 'regime-a' }, { dep: '02', taxRegime: 'regime-b' }],
  };
  const fakePrisma = { fiscalConfig: { findUnique: async () => row } } as never;
  const adapter = new DbFiscalConfigAdapter(fakePrisma, cipher, cfg);

  await checkAsync('db adapter: decrypts cert/key + builds departmentMap + baseUrl', async () => {
    const out = await adapter.getConfig('r', 'b');
    assert.strictEqual(out.crn, '12345678');
    assert.strictEqual((out.clientCert as Buffer).toString('utf8'), CERT);
    assert.strictEqual((out.clientKey as Buffer).toString('utf8'), KEY);
    assert.strictEqual(out.departmentMap['01'], 'regime-a');
    assert.strictEqual(out.departmentMap['02'], 'regime-b');
    assert.strictEqual(out.baseUrl, 'https://10.3.14.123:447');
    assert.strictEqual((out.caRoot as Buffer).toString('utf8'), 'CA-PEM-BODY');
  });

  await checkAsync('db adapter: inactive config -> throws (fail closed)', async () => {
    const inactive = { fiscalConfig: { findUnique: async () => ({ ...row, active: false }) } } as never;
    const a2 = new DbFiscalConfigAdapter(inactive, cipher, cfg);
    await assert.rejects(a2.getConfig('r', 'b'));
  });

  fs.unlinkSync(caPath);
  console.log(`\n${passed} checks passed.`);
  console.log(process.exitCode === 1 ? 'VERIFY FAILED' : 'VERIFY OK');
}

async function checkAsync(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    console.error(`  FAIL  ${name}\n        ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

void run();
