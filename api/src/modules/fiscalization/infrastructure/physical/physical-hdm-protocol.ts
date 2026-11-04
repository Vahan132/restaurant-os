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
 * HDM-TM-1 — re-aligned to the SRC integration manual v0.7.3 (2025) and the
 * hardware-observed framing of the open-source `hdm-am` client:
 *   - request header: 6-byte "ՀԴՄ" indicator · 2-byte protocol version (00 05) ·
 *     1-byte fn · 1 reserved · 2-byte BE encrypted length (was 1/1/1/3 — wrong).
 *   - response header: 11 bytes (was 12) — version(2) · program version(3) ·
 *     code(2 BE) · length(2 BE) · reserved(2).
 *   - login (fn 2) needs `{ password, cashier, pin }` — the HDM operator code and
 *     PIN, not just the integration password.
 * The manual itself is internally inconsistent about the RESPONSE header; the
 * offsets below are named constants, and the hub diagnostics surface the raw
 * header hex, so a mismatch on a real TouchMaster is a one-line fix.
 * Success code is 200 (NOT 0 like e-HDM). See SESSION/FATAL code sets.
 */

// ── Protocol constants ───────────────────────────────────────────────────────

/** "ՀԴՄ" (HDM) request indicator — first 6 bytes of every request header. */
export const HDM_INDICATOR = Buffer.from([0xd5, 0x80, 0xd4, 0xb4, 0xd5, 0x84]);
/** Protocol version (2 bytes BE on the wire: 00 05). */
export const PROTOCOL_VERSION = 0x0005;
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
  HEADER_FOOTER = 7,
  HEADER_LOGO = 8,
  REPORT = 9,
  GET_RECEIPT = 10,
  CASH_IN_OUT = 11,
  DATE_TIME = 12,
  RECEIPT_SAMPLE = 13,
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

// ── Header framing ───────────────────────────────────────────────────────────
// Request (12 B):  [0..5] indicator · [6..7] version (00 05) · [8] fnCode ·
//                  [9] reserved · [10..11] bodyLen (2-byte BE)
// Response (11 B): [0..1] version · [2..4] programVersion · [5..6] code (BE) ·
//                  [7..8] bodyLen (BE) · [9..10] reserved
// (Request per manual v0.7.3 §4.3; response per the hardware-observed parser —
// the manual's own response table/sample disagree. Adjust constants if needed.)

export const REQUEST_HEADER_LEN = 12;
const REQ_VERSION_OFFSET = 6;
const REQ_VERSION_WIDTH = 2;
const REQ_FN_OFFSET = 8;
const REQ_RESERVED_OFFSET = 9;
const REQ_LEN_OFFSET = 10;
const REQ_LEN_WIDTH = 2;

export const RESPONSE_HEADER_LEN = 11;
const RES_VERSION_OFFSET = 0;
const RES_VERSION_WIDTH = 2;
const RES_PROGRAM_VERSION_OFFSET = 2;
const RES_PROGRAM_VERSION_WIDTH = 3;
const RES_CODE_OFFSET = 5;
const RES_CODE_WIDTH = 2;
const RES_LEN_OFFSET = 7;
const RES_LEN_WIDTH = 2;

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
  header.writeUIntBE(PROTOCOL_VERSION, REQ_VERSION_OFFSET, REQ_VERSION_WIDTH);
  header.writeUInt8(fnCode, REQ_FN_OFFSET);
  header.writeUInt8(0x00, REQ_RESERVED_OFFSET);
  header.writeUIntBE(bodyLength, REQ_LEN_OFFSET, REQ_LEN_WIDTH);
  return header;
}

/** Parse an 11-byte response header (version, program version, code + body length, BE). */
export function parseResponseHeader(header: Buffer): ResponseHeader {
  if (header.length < RESPONSE_HEADER_LEN) {
    throw new Error(`physical-HDM: response header too short (${header.length} < ${RESPONSE_HEADER_LEN}).`);
  }
  return {
    version: header.readUIntBE(RES_VERSION_OFFSET, RES_VERSION_WIDTH),
    programVersion: header.readUIntBE(RES_PROGRAM_VERSION_OFFSET, RES_PROGRAM_VERSION_WIDTH),
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
  productCode: string;
  productName: string;
  adgCode: string;
  unit: string;
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

/** Per-device print options (HDM-TM-1). */
export interface PhysicalPrintOptions {
  /**
   * `true` (default) = card payments were taken on a SEPARATE bank terminal, the
   * HDM only records the cashless amount. `false` = the HDM starts its OWN built-in
   * cashless application for `paidAmountCard` (only for HDMs with a bank module).
   */
  useExtPos?: boolean;
  /** Fallback unit of measure when a line has none (manual: must not be empty). */
  defaultUnit?: string;
}

/** Manual §4.4.4: productCode / productName / unit are max 50 chars, non-empty. */
const MAX_TEXT = 50;
export const DEFAULT_UNIT = 'հատ';

function clip(value: string): string {
  const v = value.trim();
  return v.length > MAX_TEXT ? v.slice(0, MAX_TEXT) : v;
}

/** Stable non-empty product code: the line's goodCode, else the ADG code. */
function productCodeOf(goodCode: string | null, adgCode: string): string {
  const code = goodCode?.trim();
  return clip(code && code.length > 0 ? code : adgCode);
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
 * the order line) and must be present. Money is 2dp, quantity 3dp.
 * HDM-TM-1: `useExtPOS` defaults to TRUE — per manual v0.7.3 `false` makes the HDM
 * launch its OWN cashless app for `paidAmountCard`, which is wrong for restaurants
 * that take cards on a separate bank terminal (configurable per device).
 * productCode/unit are never empty (manual: rejected with 161/163).
 */
export function buildPrintBody(
  input: FiscalizationInput,
  options: PhysicalPrintOptions = {},
): PhysicalPrintBody {
  const unitFallback = options.defaultUnit?.trim() || DEFAULT_UNIT;
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
      productCode: productCodeOf(line.goodCode, line.adgCode),
      productName: clip(line.goodName || line.name),
      adgCode: line.adgCode,
      unit: clip(line.unit?.trim() || unitFallback),
    };
  });

  return {
    paidAmount: toAmount(input.cashAmount + input.cardAmount),
    paidAmountCard: toAmount(input.cardAmount),
    partialAmount: toAmount(input.partialAmount),
    prePaymentAmount: toAmount(input.prePaymentAmount),
    mode: input.mode,
    partnerTin: input.partnerTin,
    useExtPOS: options.useExtPos ?? true,
    items,
  };
}

// ── fn-1 operators/departments, fn-9 reports ─────────────────────────────────

export interface PhysicalOperator {
  id: number;
  name: string;
  deps: number[];
}

export interface PhysicalDepartment {
  id: number;
  name: string;
  /** Taxation type (manual: 1 = VAT, 2 = no VAT, 3 = turnover tax, 7 = micro…). */
  type: number;
}

export interface PhysicalOperatorsAndDepartments {
  operators: PhysicalOperator[];
  departments: PhysicalDepartment[];
}

/**
 * fn-1 response. The manual's table nests `c`/`d` under `list`, its example puts
 * them at the top level — accept both.
 */
export function parseOperatorsAndDepartments(json: Record<string, unknown>): PhysicalOperatorsAndDepartments {
  const root = (json.list && typeof json.list === 'object' ? json.list : json) as Record<string, unknown>;
  const arr = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[]) : [];
  return {
    operators: arr(root.c).map((o) => ({
      id: Number(o.id),
      name: String(o.name ?? ''),
      deps: Array.isArray(o.deps) ? (o.deps as unknown[]).map(Number) : [],
    })),
    departments: arr(root.d).map((d) => ({
      id: Number(d.id),
      name: String(d.name ?? ''),
      type: Number(d.type),
    })),
  };
}

/** fn-9 report type (manual §4.5.4). */
export enum PhysicalReportType {
  X = 1,
  Z = 2,
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
  /** Documented, but omitted by some firmware — never assume present. */
  qr?: string;
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
    qr: result.qr ?? '',
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
