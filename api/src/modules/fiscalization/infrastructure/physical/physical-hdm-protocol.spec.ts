import { createHash } from 'node:crypto';
import { FatalFiscalError } from '../../application/ports/fiscal-errors';
import { FiscalizationInput, FiscalMode } from '../../application/ports/fiscalization.port';
import {
  buildPrintBody,
  buildRequestHeader,
  classifyPhysicalError,
  decodeSessionKey,
  decrypt3des,
  decryptJsonBody,
  deriveKey1,
  encrypt3des,
  encryptJsonBody,
  HDM_INDICATOR,
  parsePrintResult,
  parseResponseHeader,
  PhysicalFn,
  PhysicalSessionError,
  pkcs7Pad,
  pkcs7Unpad,
  PROTOCOL_VERSION,
  REQUEST_HEADER_LEN,
} from './physical-hdm-protocol';

/**
 * FISCAL-EDGE-2 — codec unit tests. This is the SPEC-VERIFIED core: pure crypto,
 * framing, payload shaping, and error policy, all device-free.
 */

const PASSWORD = 'hdm-secret-42';

function makeInput(over: Partial<FiscalizationInput> = {}): FiscalizationInput {
  return {
    restaurantId: 'r1',
    branchId: 'b1',
    orderRef: 'o1',
    currency: 'AMD',
    channel: 'POS',
    mode: FiscalMode.PRODUCTS,
    partnerTin: null,
    lines: [
      {
        name: 'Coffee',
        goodName: 'Coffee',
        goodCode: 'C1',
        quantityThousandths: 2000, // 2.000
        unit: 'pcs',
        unitPriceAmount: 50000, // 500.00
        lineTotalAmount: 100000,
        adgCode: '21069099',
        dep: '1',
      },
    ],
    subtotalAmount: 100000,
    discountAmount: 0,
    serviceFeeAmount: 0,
    totalAmount: 100000,
    cardAmount: 100000,
    cashAmount: 0,
    partialAmount: 0,
    prePaymentAmount: 0,
    changeAmount: 0,
    ...over,
  };
}

describe('physical-HDM codec — crypto', () => {
  it('derives key1 = first 24 bytes of SHA-256(password)', () => {
    const full = createHash('sha256').update(PASSWORD, 'utf8').digest();
    const key1 = deriveKey1(PASSWORD);
    expect(key1.length).toBe(24);
    expect(key1.equals(full.subarray(0, 24))).toBe(true);
  });

  it('PKCS7 pads to the 8-byte block, adding a full block when already aligned', () => {
    expect(pkcs7Pad(Buffer.alloc(5)).length).toBe(8);
    const aligned = pkcs7Pad(Buffer.alloc(8));
    expect(aligned.length).toBe(16);
    expect(aligned[aligned.length - 1]).toBe(8);
    expect(pkcs7Unpad(aligned).length).toBe(8);
  });

  it('rejects corrupt PKCS7 padding', () => {
    const bad = Buffer.from([1, 2, 3, 4, 5, 6, 7, 9]); // last byte 9 > blocksize
    expect(() => pkcs7Unpad(bad)).toThrow(/PKCS7/);
  });

  it('3DES-ECB round-trips and produces block-aligned ciphertext', () => {
    const key = deriveKey1(PASSWORD);
    const pt = Buffer.from('{"seq":7}', 'utf8');
    const ct = encrypt3des(key, pt);
    expect(ct.length % 8).toBe(0);
    expect(ct.equals(pt)).toBe(false);
    expect(decrypt3des(key, ct).equals(pt)).toBe(true);
  });

  it('encrypts/decrypts a JSON body round-trip', () => {
    const key = deriveKey1(PASSWORD);
    const body = { seq: 3, mode: 2, items: [{ adgCode: '1', qty: 1.5 }] };
    expect(decryptJsonBody(key, encryptJsonBody(key, body))).toEqual(body);
  });

  it('decodes a 24-byte Base64 session key and rejects a wrong length', () => {
    const key2 = Buffer.alloc(24, 7);
    expect(decodeSessionKey(key2.toString('base64')).equals(key2)).toBe(true);
    expect(() => decodeSessionKey(Buffer.alloc(16).toString('base64'))).toThrow(/24 bytes/);
  });
});

describe('physical-HDM codec — framing', () => {
  it('builds a 12-byte request header (indicator, version, fn, reserved, BE length)', () => {
    const header = buildRequestHeader(PhysicalFn.PRINT, 0x0102);
    expect(header.length).toBe(REQUEST_HEADER_LEN);
    expect(header.subarray(0, 6).equals(HDM_INDICATOR)).toBe(true);
    expect(header[6]).toBe(PROTOCOL_VERSION);
    expect(header[7]).toBe(PhysicalFn.PRINT);
    expect(header[8]).toBe(0x00); // reserved
    // 3-byte BigEndian length at offset 9
    expect(header.readUIntBE(9, 3)).toBe(0x0102);
    expect([header[9], header[10], header[11]]).toEqual([0x00, 0x01, 0x02]);
  });

  it('parses a response header with BigEndian code + length', () => {
    const h = Buffer.alloc(12);
    h.writeUInt8(5, 0);
    h.writeUInt8(9, 1); // program version
    h.writeUIntBE(200, 2, 2); // code
    h.writeUIntBE(345, 4, 4); // body length
    const parsed = parseResponseHeader(h);
    expect(parsed).toMatchObject({ version: 5, programVersion: 9, responseCode: 200, bodyLength: 345 });
  });
});

describe('physical-HDM codec — fn-4 print payload', () => {
  it('shapes money (2dp), qty (3dp), dep, useExtPOS=false, paidAmount=cash+card', () => {
    const body = buildPrintBody(makeInput({ cashAmount: 40000, cardAmount: 60000 }));
    expect(body.mode).toBe(2);
    expect(body.useExtPOS).toBe(false);
    expect(body.paidAmount).toBe(1000); // (40000+60000)/100
    expect(body.paidAmountCard).toBe(600);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      dep: 1,
      qty: 2, // 2.000
      price: 500, // 500.00
      productCode: 'C1',
      productName: 'Coffee',
      adgCode: '21069099',
      unit: 'pcs',
    });
    // seq is NOT part of the pure body (the session injects it).
    expect('seq' in body).toBe(false);
  });

  it('FAILS CLOSED with FatalFiscalError DEP_REQUIRED on a missing dep (before any send)', () => {
    // FISCAL-DEPT-1: the silent lowest-department fallback is removed — a line with
    // no fiscal department fails closed pre-flight instead of routing to a default.
    const input = makeInput();
    input.lines[0].dep = null;
    expect(() => buildPrintBody(input)).toThrow(FatalFiscalError);
    try {
      buildPrintBody(input);
    } catch (e) {
      expect((e as FatalFiscalError).code).toBe('DEP_REQUIRED');
    }
  });

  it('FAILS CLOSED with FatalFiscalError 192 on a missing adgCode (before any send)', () => {
    const input = makeInput();
    input.lines[0].adgCode = '';
    expect(() => buildPrintBody(input)).toThrow(FatalFiscalError);
    try {
      buildPrintBody(input);
    } catch (e) {
      expect((e as FatalFiscalError).code).toBe('192');
    }
  });
});

describe('physical-HDM codec — print response', () => {
  it('maps a print result onto the shared FiscalizationResult shape', () => {
    const input = makeInput();
    const result = parsePrintResult(
      {
        rseq: 42,
        crn: '00123456',
        sn: 'HDM-SN-9',
        time: 1_750_000_000_000,
        fiscal: 'F-77',
        total: 1000, // 1000.00
        change: 0,
        qr: 'https://verify?x=1',
        verificationNumber: 'V9',
      },
      input,
    );
    expect(result).toMatchObject({
      receiptId: '42',
      fiscalNumber: 'F-77',
      fiscalReference: 'F-77',
      sn: 'HDM-SN-9',
      qr: 'https://verify?x=1',
      issuedAtEpochMs: 1_750_000_000_000,
      totalAmount: 100000, // 1000.00 -> minor units
    });
    expect(result.issuedAt.getTime()).toBe(1_750_000_000_000);
  });
});

describe('physical-HDM codec — error classification', () => {
  it('routes session codes 101–105 to PhysicalSessionError (recoverable)', () => {
    for (const code of [101, 102, 103, 104, 105]) {
      expect(() => classifyPhysicalError(code, 'x')).toThrow(PhysicalSessionError);
    }
  });

  it('routes 155/156 (needs-sync) to FatalFiscalError with the code PRESERVED', () => {
    for (const code of [155, 156]) {
      try {
        classifyPhysicalError(code, 'needs sync');
        throw new Error('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(FatalFiscalError);
        expect((e as FatalFiscalError).code).toBe(String(code));
      }
    }
  });

  it('defaults unknown non-session codes to fatal (183 invalid adgCode, 152 paid<total)', () => {
    for (const code of [152, 183, 192, 999]) {
      expect(() => classifyPhysicalError(code, 'x')).toThrow(FatalFiscalError);
    }
  });
});
