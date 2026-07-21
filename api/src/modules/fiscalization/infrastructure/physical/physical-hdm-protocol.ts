import { createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { Money } from '../../../../shared/domain/value-objects/money';
import { Quantity } from '../../../../shared/domain/value-objects/quantity';
import { FatalFiscalError } from '../../application/ports/fiscal-errors';
import { FiscalizationInput, FiscalizationResult } from '../../application/ports/fiscalization.port';

/**
 * FISCAL-EDGE-2 — PURE codec for the SRC physical-HDM "external app integration"
 * protocol (3DES-ECB + PKCS7, JSON body, 12-byte framing). No sockets, no state:
 * every function here is deterministic and unit-testable offline against the
 * manual's sample payloads. The stateful session/transport lives separately.
 *
 * ┌─ HARDWARE-UNVERIFIED ──────────────────────────────────────────────────────┐
 * │ Written against the manual summary; NOT yet checked against a real device.  │
 * │ The exact BYTE LAYOUT of the request/response headers (field widths, the    │
 * │ reserved byte position, and whether the body-length is 3- or 4-byte BE) is  │
 * │ the highest-risk assumption — it is expressed below as named offset/width   │
 * │ constants so a single edit re-aligns everything once the device confirms.   │
 * │ Success code is 200 (NOT 0 like e-HDM). See SESSION/FATAL code sets.         │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */

// ── Protocol constants ───────────────────────────────────────────────────────

/** "ՀԴՄ" (HDM) request indicator — first 6 bytes of every request header. */
export const HDM_INDICATOR = Buffer.from([0xd5, 0x80, 0xd4, 0xb4, 0xd5, 0x84]);
/** Protocol version byte. */
export const PROTOCOL_VERSION = 0x05;
/** Max request size (manual): 50 KB. */
export const MAX_REQUEST_BYTES = 50 * 1024;

/** SRC physical-HDM function codes. */
export enum PhysicalFn {
  GET_OPERATORS_DEPARTMENTS = 1,
  LOGIN = 2,
  LOGOUT = 3,
  PRINT = 4,
  PRINT_LAST_COPY = 5,
  RETURN = 6,
  GET_RECEIPT = 10,
  DATE_TIME = 12,
  SYNC = 14,
  PAYMENT_SYSTEMS = 15,
  EMARK_CHECK = 16,
}

/** Success response code (manual: 200 = OK). */
export const PHYSICAL_OK_CODE = 200;

/**
 * Session/`seq` codes (101–105): recoverable at the SESSION layer — re-login
 * then retry once. Surfaced as retryable only if re-login still fails.
 */
export const PHYSICAL_SESSION_CODES: ReadonlySet<number> = new Set([101, 102, 103, 104, 105]);

/**
 * FATAL codes — retrying cannot fix them; recorded on the order to STOP the loop
 * (mirrors the e-HDM default-fatal policy). Notable: 152 paid < total, 155/156
 * needs-sync, 183 invalid adgCode, 192 adgCode required.
 *
 * NOTE (155/156): fatal FOR NOW because device-sync (fn 14) is out of scope, so
 * they can't self-heal — they surface to the operator. The SRC CODE IS PRESERVED
 * on the order (Order.fiscalError), so when fn 14 lands 155/156 can graduate to
 * "auto-sync then retry once" keyed on that code — a clean upgrade, not an
 * archaeology exercise.
 */
export const PHYSICAL_FATAL_CODES: ReadonlySet<number> = new Set([152, 155, 156, 183, 192]);

// ── Header framing (12 bytes) ────────────────────────────────────────────────
// Request:  [0..5] indicator · [6] version · [7] fnCode · [8] reserved · [9..11] bodyLen (3-byte BE)
// Response: [0] version · [1] programVersion · [2..3] responseCode (2-byte BE) ·
//           [4..7] bodyLen (4-byte BE) · [8..11] reserved
// (Widths per the manual summary; adjust these constants if the device disagrees.)

export const REQUEST_HEADER_LEN = 12;
const REQ_VERSION_OFFSET = 6;
const REQ_FN_OFFSET = 7;
const REQ_RESERVED_OFFSET = 8;
const REQ_LEN_OFFSET = 9;
const REQ_LEN_WIDTH = 3;

export const RESPONSE_HEADER_LEN = 12;
const RES_VERSION_OFFSET = 0;
const RES_PROGRAM_VERSION_OFFSET = 1;
const RES_CODE_OFFSET = 2;
const RES_CODE_WIDTH = 2;
const RES_LEN_OFFSET = 4;
const RES_LEN_WIDTH = 4;

export interface ResponseHeader {
  version: number;
  programVersion: number;
  responseCode: number;
  bodyLength: number;
}

/** Build the 12-byte request header for a function code + encrypted body length. */
export function buildRequestHeader(fnCode: PhysicalFn, bodyLength: number): Buffer {
  if (bodyLength < 0 || bodyLength > MAX_REQUEST_BYTES) {
    throw new Error(`physical-HDM: body length ${bodyLength} out of range (max ${MAX_REQUEST_BYTES}).`);
  }
  const header = Buffer.alloc(REQUEST_HEADER_LEN);
  HDM_INDICATOR.copy(header, 0);
  header.writeUInt8(PROTOCOL_VERSION, REQ_VERSION_OFFSET);
  header.writeUInt8(fnCode, REQ_FN_OFFSET);
  header.writeUInt8(0x00, REQ_RESERVED_OFFSET);
  header.writeUIntBE(bodyLength, REQ_LEN_OFFSET, REQ_LEN_WIDTH);
  return header;
}

/** Parse a 12-byte response header (version, program version, code + body length, BE). */
export function parseResponseHeader(header: Buffer): ResponseHeader {
  if (header.length < RESPONSE_HEADER_LEN) {
    throw new Error(`physical-HDM: response header too short (${header.length} < ${RESPONSE_HEADER_LEN}).`);
  }
  return {
    version: header.readUInt8(RES_VERSION_OFFSET),
    programVersion: header.readUInt8(RES_PROGRAM_VERSION_OFFSET),
    responseCode: header.readUIntBE(RES_CODE_OFFSET, RES_CODE_WIDTH),
    bodyLength: header.readUIntBE(RES_LEN_OFFSET, RES_LEN_WIDTH),
  };
}

// ── Key derivation + 3DES-ECB + PKCS7 ────────────────────────────────────────

const DES3_KEY_BYTES = 24;
const DES_BLOCK_BYTES = 8;
const ALGO = 'des-ede3-ecb';

/** key1 = first 24 bytes of SHA-256(device password). Encrypts fn 1 + fn 2. */
export function deriveKey1(devicePassword: string): Buffer {
  return createHash('sha256').update(devicePassword, 'utf8').digest().subarray(0, DES3_KEY_BYTES);
}

/** Decode the Base64 session key (`key2`, 24 bytes) returned by login (fn 2). */
export function decodeSessionKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== DES3_KEY_BYTES) {
    throw new Error(`physical-HDM: session key must be ${DES3_KEY_BYTES} bytes (got ${key.length}).`);
  }
  return key;
}

/** Manual PKCS7 pad to the 8-byte 3DES block (a full extra block when already aligned). */
export function pkcs7Pad(data: Buffer, blockSize = DES_BLOCK_BYTES): Buffer {
  const padLen = blockSize - (data.length % blockSize) || blockSize;
  return Buffer.concat([data, Buffer.alloc(padLen, padLen)]);
}

/** Manual PKCS7 unpad, validating the padding bytes. */
export function pkcs7Unpad(data: Buffer, blockSize = DES_BLOCK_BYTES): Buffer {
  if (data.length === 0 || data.length % blockSize !== 0) {
    throw new Error('physical-HDM: invalid PKCS7 length.');
  }
  const padLen = data[data.length - 1];
  if (padLen < 1 || padLen > blockSize) {
    throw new Error('physical-HDM: invalid PKCS7 padding value.');
  }
  for (let i = data.length - padLen; i < data.length; i++) {
    if (data[i] !== padLen) {
      throw new Error('physical-HDM: corrupt PKCS7 padding.');
    }
  }
  return data.subarray(0, data.length - padLen);
}

/** 3DES-ECB encrypt with manual PKCS7 (autopadding OFF so the pad is spec-exact). */
export function encrypt3des(key: Buffer, plaintext: Buffer): Buffer {
  const cipher = createCipheriv(ALGO, key, null);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(pkcs7Pad(plaintext)), cipher.final()]);
}

/** 3DES-ECB decrypt with manual PKCS7 unpad. */
export function decrypt3des(key: Buffer, ciphertext: Buffer): Buffer {
  const decipher = createDecipheriv(ALGO, key, null);
  decipher.setAutoPadding(false);
  const padded = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return pkcs7Unpad(padded);
}

/** Encrypt a JSON body: object → UTF-8 JSON → 3DES-ECB+PKCS7. */
export function encryptJsonBody(key: Buffer, body: unknown): Buffer {
  return encrypt3des(key, Buffer.from(JSON.stringify(body), 'utf8'));
}

/** Decrypt + JSON-parse a response body. */
export function decryptJsonBody<T = Record<string, unknown>>(key: Buffer, ciphertext: Buffer): T {
  return JSON.parse(decrypt3des(key, ciphertext).toString('utf8')) as T;
}

// ── fn-4 print payload (mode 2) ──────────────────────────────────────────────

export interface PhysicalPrintItem {
  dep: number | null;
  qty: number;
  price: number;
  productCode: string | null;
  productName: string;
  adgCode: string;
  unit: string | null;
}

/**
 * fn-4 print request body WITHOUT `seq` — the session client injects `seq`
 * (monotonic per session) immediately before send, so this stays pure.
 */
export interface PhysicalPrintBody {
  paidAmount: number;
  paidAmountCard: number;
  partialAmount: number;
  prePaymentAmount: number;
  mode: number;
  partnerTin: string | null;
  useExtPOS: boolean;
  items: PhysicalPrintItem[];
}

/** Minor units → 2dp number ("1234" → 12.34) at the wire boundary only. */
function toAmount(minorUnits: number): number {
  return Number(Money.fromMinorUnits(minorUnits).toDecimalString());
}

/** Thousandths → 3dp number ("1500" → 1.5) at the wire boundary only. */
function toQty(thousandths: number): number {
  return Number(Quantity.fromThousandths(thousandths).toDecimalString());
}

/**
 * Build the fn-4 (mode-2 products) print body from the fiscal input.
 *
 * FAIL-CLOSED (mirrors e-HDM): a line with no `adgCode` throws FatalFiscalError
 * 192, and (FISCAL-DEPT-1) a line with no `dep` throws FatalFiscalError
 * DEP_REQUIRED, BOTH BEFORE any send — the device would reject/misclassify it and a
 * loop would never heal. The previous silent lowest-department fallback is removed:
 * a line's fiscal department now comes per-menu-item (MenuItem.dep, snapshotted onto
 * the order line) and must be present. Money is 2dp, quantity 3dp; `useExtPOS=false`
 * (we don't drive the device's own POS terminal). — the money-field mapping +
 * useExtPOS are HARDWARE-UNVERIFIED assumptions to confirm against the manual's sample.
 */
export function buildPrintBody(input: FiscalizationInput): PhysicalPrintBody {
  const items: PhysicalPrintItem[] = input.lines.map((line) => {
    if (line.adgCode === null || line.adgCode.trim() === '') {
      throw new FatalFiscalError(
        '192',
        `ADG_CODE_REQUIRED: line "${line.goodName}" has no adgCode (fail closed pre-flight).`,
      );
    }
    // FISCAL-DEPT-1: fail closed on a missing fiscal department (this builder only
    // runs on the fiscalize path / fiscal-active branches).
    if (line.dep === null || line.dep.trim() === '') {
      throw new FatalFiscalError(
        'DEP_REQUIRED',
        `DEP_REQUIRED: line "${line.goodName}" has no fiscal department (fail closed pre-flight).`,
      );
    }
    return {
      dep: Number(line.dep),
      qty: toQty(line.quantityThousandths),
      price: toAmount(line.unitPriceAmount),
      productCode: line.goodCode,
      productName: line.goodName,
      adgCode: line.adgCode,
      unit: line.unit,
    };
  });

  return {
    paidAmount: toAmount(input.cashAmount + input.cardAmount),
    paidAmountCard: toAmount(input.cardAmount),
    partialAmount: toAmount(input.partialAmount),
    prePaymentAmount: toAmount(input.prePaymentAmount),
    mode: input.mode,
    partnerTin: input.partnerTin,
    useExtPOS: false,
    items,
  };
}

// ── Print response → FiscalizationResult ─────────────────────────────────────

export interface PhysicalPrintResult {
  rseq: string | number;
  crn?: string;
  sn: string | number;
  tin?: string;
  taxpayer?: string;
  address?: string;
  /** GMT epoch ms. */
  time: string | number;
  fiscal: string | number;
  total?: string | number;
  change?: string | number;
  qr: string;
  verificationNumber?: string | number;
}

/** SRC 2dp number/string → minor units (fallback on absent/NaN). */
function toMinorUnits(value: string | number | undefined, fallback: number): number {
  if (value === undefined || value === null) {
    return fallback;
  }
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Money.roundHalfUp(n * 100).minorUnits;
}

/** Map a fn-4 print result onto the shared FiscalizationResult (same shape e-HDM returns). */
export function parsePrintResult(
  result: PhysicalPrintResult,
  input: FiscalizationInput,
): FiscalizationResult {
  const epochMs = Number(result.time);
  const issuedAt = new Date(Number.isFinite(epochMs) ? epochMs : Date.now());
  const fiscal = String(result.fiscal);
  return {
    receiptId: String(result.rseq),
    fiscalReference: fiscal,
    fiscalNumber: fiscal,
    sn: String(result.sn),
    qr: result.qr,
    issuedAtEpochMs: Number.isFinite(epochMs) ? epochMs : issuedAt.getTime(),
    totalAmount: toMinorUnits(result.total, input.totalAmount),
    changeAmount: toMinorUnits(result.change, input.changeAmount),
    issuedAt,
  };
}

// ── Error classification ─────────────────────────────────────────────────────

/**
 * A recoverable session/`seq` error (101–105). The session layer catches this,
 * re-logins, and retries once. It is NOT a FatalFiscalError, so it never lands on
 * the order unless re-login also fails (then surfaced as a retryable Error).
 */
export class PhysicalSessionError extends Error {
  constructor(
    readonly code: number,
    message?: string,
  ) {
    super(message ?? `physical-HDM session error ${code}.`);
    this.name = 'PhysicalSessionError';
  }
}

/**
 * Throw the right error type for a non-OK (`!= 200`) physical response code.
 *   - 101–105 → PhysicalSessionError (session layer re-logins + retries once).
 *   - everything else → FatalFiscalError(code) (default-fatal, mirrors e-HDM):
 *     recorded on the order to STOP the loop, SRC code preserved.
 * Transport failures (socket/timeout) are thrown as ordinary Errors by the
 * transport layer — those are the retryable class.
 */
export function classifyPhysicalError(code: number, message: string): never {
  if (PHYSICAL_SESSION_CODES.has(code)) {
    throw new PhysicalSessionError(code, `physical-HDM session error ${code}: ${message}`);
  }
  // PHYSICAL_FATAL_CODES is documentation of the notable ones; the policy is
  // default-fatal for every non-session, non-OK code.
  throw new FatalFiscalError(String(code), `physical-HDM fatal error ${code}: ${message}`);
}
