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
  parseOperatorsAndDepartments,
  parseResponseHeader,
  PhysicalFn,
  PhysicalSessionError,
  pkcs7Pad,
  pkcs7Unpad,
  PROTOCOL_VERSION,
  REQUEST_HEADER_LEN,
  RESPONSE_HEADER_LEN,
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
  it('builds the 12-byte request header per manual v0.7.3 (indicator, 00 05, fn, reserved, 2-byte BE length)', () => {
    const header = buildRequestHeader(PhysicalFn.PRINT, 0x0205);
    expect(header.length).toBe(REQUEST_HEADER_LEN);
    expect(header.subarray(0, 6).equals(HDM_INDICATOR)).toBe(true);
    expect([header[6], header[7]]).toEqual([0x00, 0x05]); // protocol version
    expect(header.readUIntBE(6, 2)).toBe(PROTOCOL_VERSION);
    expect(header[8]).toBe(PhysicalFn.PRINT);
    expect(header[9]).toBe(0x00); // reserved
    expect([header[10], header[11]]).toEqual([0x02, 0x05]); // 517 BE
  });

  it('matches the manual sample header for fn 1 with a 517-byte body', () => {
    const header = buildRequestHeader(PhysicalFn.GET_OPERATORS_DEPARTMENTS, 517);
    expect(header.toString('hex')).toBe('d580d4b4d584' + '0005' + '01' + '00' + '0205');
  });

  it('parses an 11-byte response header with BigEndian code + length', () => {
    const h = Buffer.alloc(11);
    h.writeUIntBE(5, 0, 2); // version
    h.writeUIntBE(0x070300, 2, 3); // program version
    h.writeUIntBE(200, 5, 2); // code
    h.writeUIntBE(345, 7, 2); // body length
    expect(RESPONSE_HEADER_LEN).toBe(11);
    const parsed = parseResponseHeader(h);
    expect(parsed).toMatchObject({ version: 5, programVersion: 0x070300, responseCode: 200, bodyLength: 345 });
  });
});

describe('physical-HDM codec — fn-1 operators/departments', () => {
  it('accepts both the top-level and the `list`-nested shapes', () => {
    const flat = { c: [{ id: 2, name: 'Գայանե', deps: [1, 2] }], d: [{ id: 1, name: 'Մրգեր', type: 1 }] };
    const expected = {
      operators: [{ id: 2, name: 'Գայանե', deps: [1, 2] }],
      departments: [{ id: 1, name: 'Մրգեր', type: 1 }],
    };
    expect(parseOperatorsAndDepartments(flat)).toEqual(expected);
    expect(parseOperatorsAndDepartments({ list: flat })).toEqual(expected);
    expect(parseOperatorsAndDepartments({})).toEqual({ operators: [], departments: [] });
  });
});

describe('physical-HDM codec — fn-4 print payload', () => {
  it('shapes money (2dp), qty (3dp), dep, useExtPOS=true by default, paidAmount=cash+card', () => {
    const body = buildPrintBody(makeInput({ cashAmount: 40000, cardAmount: 60000 }));
    expect(body.mode).toBe(2);
    expect(body.useExtPOS).toBe(true);
    expect(buildPrintBody(makeInput({}), { useExtPos: false }).useExtPOS).toBe(false);
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
