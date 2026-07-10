/**
 * Offline verification for the FISCAL-1 e-HDM adapter (no live SRC access). Runs
 * the PURE protocol functions + the adapter (with a fake transport/config) against
 * the manual's sample request/response shapes, asserting payload mapping, response
 * parsing, error classification, the fail-closed pre-flight, and channel routing.
 *
 *   pnpm run verify:ehdm      (ts-node --transpile-only)
 *
 * Exits non-zero on the first failed assertion.
 */
import * as assert from 'node:assert';
import {
  FiscalizationInput,
  FiscalMode,
} from '../src/modules/fiscalization/application/ports/fiscalization.port';
import { TenantFiscalConfig } from '../src/modules/fiscalization/application/ports/fiscal-config.port';
import {
  EHdmTransport,
  EHdmHttpResponse,
} from '../src/modules/fiscalization/application/ports/ehdm-transport.port';
import { FatalFiscalError } from '../src/modules/fiscalization/application/ports/fiscal-errors';
import {
  buildPrintPayload,
  classifyAndThrow,
  parsePrintResponse,
  EHdmResponse,
} from '../src/modules/fiscalization/application/ehdm-protocol';
import { EHdmFiscalizationAdapter } from '../src/modules/fiscalization/infrastructure/adapters/ehdm-fiscalization.adapter';
import { ChannelRouterFiscalizationAdapter } from '../src/modules/fiscalization/infrastructure/adapters/channel-router-fiscalization.adapter';
import { StubFiscalizationAdapter } from '../src/modules/fiscalization/infrastructure/adapters/stub-fiscalization.adapter';

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

// ── Fixtures ─────────────────────────────────────────────────────────────────

const CFG: TenantFiscalConfig = {
  crn: '12345678',
  cashierId: 'CASHIER-1',
  environment: 'TEST',
  baseUrl: 'https://10.3.14.123:447',
  clientCert: 'PEM-CERT',
  clientKey: 'PEM-KEY',
  caRoot: 'PEM-CA',
  language: 'hy',
  departmentMap: {},
};

function makeInput(overrides: Partial<FiscalizationInput> = {}): FiscalizationInput {
  return {
    restaurantId: 'r1',
    branchId: 'b1',
    orderRef: 'o1',
    currency: 'AMD',
    channel: 'QR_WEB',
    mode: FiscalMode.PRODUCTS,
    partnerTin: null,
    lines: [
      {
        name: 'Pork khorovats',
        goodName: 'Pork khorovats',
        goodCode: 'pork-khorovats',
        quantityThousandths: 1000,
        unit: 'pcs',
        unitPriceAmount: 3500,
        lineTotalAmount: 3500,
        adgCode: '2130000000',
        dep: null,
      },
    ],
    subtotalAmount: 3500,
    discountAmount: 0,
    serviceFeeAmount: 0,
    totalAmount: 3500,
    cardAmount: 3500,
    cashAmount: 0,
    partialAmount: 0,
    prePaymentAmount: 0,
    changeAmount: 0,
    ...overrides,
  };
}

// The manual's success `result` shape.
const SUCCESS: EHdmResponse = {
  code: 0,
  result: {
    receiptId: 'R123',
    crn: '12345678',
    sn: 'SN9',
    tin: '00123456',
    taxpayer: 'Tavern Ararat',
    address: 'Yerevan',
    time: 1720000000000,
    fiscal: 'FSC42',
    total: 35.0,
    change: 0,
    qr: '12345678,12345678,SN9,R123,1720000000000,FSC42,0.00,35.00,0.00,0.00,35.00',
  },
};

class FakeTransport implements EHdmTransport {
  constructor(private readonly responder: () => Promise<EHdmHttpResponse>) {}
  postJson(): Promise<EHdmHttpResponse> {
    return this.responder();
  }
}

const okTransport = new FakeTransport(() => Promise.resolve({ status: 200, json: SUCCESS }));
const fatalTransport = new FakeTransport(() =>
  Promise.resolve({ status: 200, json: { code: 403, errorMessage: 'UNAUTHORIZED_CONNECTION' } }),
);
const http500Transport = new FakeTransport(() => Promise.resolve({ status: 500, json: null }));
const networkDownTransport = new FakeTransport(() => Promise.reject(new Error('ECONNREFUSED')));

const configFor = (cfg: TenantFiscalConfig | Error) => ({
  getConfig: () => (cfg instanceof Error ? Promise.reject(cfg) : Promise.resolve(cfg)),
});

// ── 1. Payload mapping (money 2dp / quantity 3dp, mode 2) ─────────────────────
check('buildPrintPayload maps mode-2 fields at wire precision', () => {
  const p = buildPrintPayload(makeInput(), CFG);
  assert.strictEqual(p.mode, 2);
  assert.strictEqual(p.crn, '12345678');
  assert.strictEqual(p.cashierId, 'CASHIER-1');
  assert.strictEqual(p.partnerTin, null);
  assert.strictEqual(p.cardAmount, '35.00');
  assert.strictEqual(p.cashAmount, '0.00');
  assert.strictEqual(p.items.length, 1);
  assert.strictEqual(p.items[0].adgCode, '2130000000');
  assert.strictEqual(p.items[0].price, '35.00');
  assert.strictEqual(p.items[0].quantity, '1.000');
  assert.strictEqual(p.items[0].unit, 'pcs');
});

check('buildPrintPayload renders fractional quantity/price correctly', () => {
  const input = makeInput({
    lines: [
      {
        name: 'Cheese', goodName: 'Cheese', goodCode: 'c1',
        quantityThousandths: 1500, unit: 'kg',
        unitPriceAmount: 1299, lineTotalAmount: 1949,
        adgCode: '0406900000', dep: null,
      },
    ],
  });
  const p = buildPrintPayload(input, CFG);
  assert.strictEqual(p.items[0].quantity, '1.500');
  assert.strictEqual(p.items[0].price, '12.99');
});

// ── 2. Fail-closed pre-flight (null adgCode → FatalFiscalError 192) ───────────
check('buildPrintPayload fails closed on a null-adgCode line (192, pre-HTTP)', () => {
  const input = makeInput({
    lines: [
      {
        name: 'Uncoded', goodName: 'Uncoded', goodCode: 'x',
        quantityThousandths: 1000, unit: 'pcs',
        unitPriceAmount: 1000, lineTotalAmount: 1000,
        adgCode: null, dep: null,
      },
    ],
  });
  assert.throws(
    () => buildPrintPayload(input, CFG),
    (e: unknown) => e instanceof FatalFiscalError && e.code === '192',
  );
});

// ── 3. Response parsing ──────────────────────────────────────────────────────
check('parsePrintResponse maps result incl. sn + qr + 2dp total', () => {
  const r = parsePrintResponse(SUCCESS.result!, makeInput());
  assert.strictEqual(r.receiptId, 'R123');
  assert.strictEqual(r.fiscalNumber, 'FSC42');
  assert.strictEqual(r.sn, 'SN9');
  assert.strictEqual(r.qr, SUCCESS.result!.qr);
  assert.strictEqual(r.issuedAtEpochMs, 1720000000000);
  assert.strictEqual(r.issuedAt instanceof Date, true);
  assert.strictEqual(r.totalAmount, 3500); // 35.00 -> minor units
  assert.strictEqual(r.changeAmount, 0);
});

// ── 4. Error classification ──────────────────────────────────────────────────
check('classifyAndThrow: fatal-config code → FatalFiscalError', () => {
  assert.throws(
    () => classifyAndThrow(403, 'x'),
    (e: unknown) => e instanceof FatalFiscalError && e.code === '403',
  );
});
check('classifyAndThrow: 500 → ordinary Error (retryable)', () => {
  assert.throws(
    () => classifyAndThrow(500, 'x'),
    (e: unknown) => e instanceof Error && !(e instanceof FatalFiscalError),
  );
});
check('classifyAndThrow: unknown code defaults to fatal (no infinite loop)', () => {
  assert.throws(
    () => classifyAndThrow(152, 'PAID_AMOUNT_LESS_THAN_TOTAL'),
    (e: unknown) => e instanceof FatalFiscalError && e.code === '152',
  );
});

// ── 5. Adapter behaviour (fake transport/config) ─────────────────────────────
async function run(): Promise<void> {
  await checkAsync('adapter.fiscalize returns the parsed result on success', async () => {
    const a = new EHdmFiscalizationAdapter(configFor(CFG) as any, okTransport);
    const r = await a.fiscalize(makeInput());
    assert.strictEqual(r.receiptId, 'R123');
    assert.strictEqual(r.sn, 'SN9');
  });

  await checkAsync('adapter.fiscalize throws FatalFiscalError on a fatal SRC code', async () => {
    const a = new EHdmFiscalizationAdapter(configFor(CFG) as any, fatalTransport);
    await assert.rejects(
      a.fiscalize(makeInput()),
      (e: unknown) => e instanceof FatalFiscalError && e.code === '403',
    );
  });

  await checkAsync('adapter.fiscalize: HTTP 500 → retryable (not FatalFiscalError)', async () => {
    const a = new EHdmFiscalizationAdapter(configFor(CFG) as any, http500Transport);
    await assert.rejects(
      a.fiscalize(makeInput()),
      (e: unknown) => e instanceof Error && !(e instanceof FatalFiscalError),
    );
  });

  await checkAsync('adapter.fiscalize: transport down → retryable (not FatalFiscalError)', async () => {
    const a = new EHdmFiscalizationAdapter(configFor(CFG) as any, networkDownTransport);
    await assert.rejects(
      a.fiscalize(makeInput()),
      (e: unknown) => e instanceof Error && !(e instanceof FatalFiscalError),
    );
  });

  await checkAsync('adapter.fiscalize: missing tenant config → FatalFiscalError', async () => {
    const missing = configFor(new FatalFiscalError('FISCAL_CONFIG_MISSING', 'none'));
    const a = new EHdmFiscalizationAdapter(missing as any, okTransport);
    await assert.rejects(
      a.fiscalize(makeInput()),
      (e: unknown) => e instanceof FatalFiscalError,
    );
  });

  // ── 6. Channel router ──────────────────────────────────────────────────────
  const ehdm = new EHdmFiscalizationAdapter(configFor(CFG) as any, okTransport);
  const stub = new StubFiscalizationAdapter();
  const router = new ChannelRouterFiscalizationAdapter(ehdm, stub);

  await checkAsync('router: QR_WEB → e-HDM adapter', async () => {
    const r = await router.fiscalize(makeInput({ channel: 'QR_WEB' }));
    assert.strictEqual(r.receiptId, 'R123');
  });
  await checkAsync('router: APP → e-HDM adapter', async () => {
    const r = await router.fiscalize(makeInput({ channel: 'APP' }));
    assert.strictEqual(r.receiptId, 'R123');
  });
  await checkAsync('router: POS → stub (physical HDM lands FISCAL-2)', async () => {
    const r = await router.fiscalize(makeInput({ channel: 'POS' }));
    assert.ok(r.receiptId.startsWith('STUB-'), `expected STUB- receipt, got ${r.receiptId}`);
  });

  console.log(`\n${passed} checks passed.`);
  if (process.exitCode === 1) {
    console.error('VERIFY FAILED');
  } else {
    console.log('VERIFY OK');
  }
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
