import { Money } from '../../../shared/domain/value-objects/money';
import { Quantity } from '../../../shared/domain/value-objects/quantity';
import { FatalFiscalError } from './ports/fiscal-errors';
import { FiscalizationInput, FiscalizationResult } from './ports/fiscalization.port';
import { FiscalEnvironment, TenantFiscalConfig } from './ports/fiscal-config.port';

/**
 * SRC electronic-HDM protocol: the wire shapes, the money/quantity precision
 * boundary, and the retryable-vs-fatal classification. Kept as pure functions so
 * the mapping, parsing, and error policy are unit-verifiable offline against the
 * manual's sample payloads (there is no live SRC access in this environment).
 */

/** SRC e-HDM roots (authoritative, from the manual). */
export const SRC_ROOT_PROD = 'https://ecrm.taxservice.am/taxsystem-rs-vcr';
export const SRC_ROOT_TEST = 'https://10.3.14.123:447';

export function resolveBaseUrl(env: FiscalEnvironment): string {
  return env === 'PROD' ? SRC_ROOT_PROD : SRC_ROOT_TEST;
}

/**
 * FATAL-config SRC error codes (decision E): a misconfiguration/data condition
 * that retrying cannot fix. Everything else that is not a network/500/transient
 * failure is treated as fatal too (default-fatal) so a broken order never loops
 * forever — only explicit transient conditions are retryable.
 */
export const FATAL_FISCAL_CODES: ReadonlySet<string> = new Set([
  '403', // UNAUTHORIZED_CONNECTION (IP/cert mismatch)
  '103', // INVALID_CRN
  '106', // cert-CRN issue
  '107', // cert-CRN issue
  '183', // INVALID_ADG_CODE
  '192', // ADG_CODE_REQUIRED
  '195', // CRM_ACTIVATION_FAILED
  '196', // INACTIVE_CERT_CRM
  '199', // BLOCKED_CERT_CRM
]);

/** SRC codes we treat as retryable/transient (throw an ordinary Error). */
export const RETRYABLE_FISCAL_CODES: ReadonlySet<string> = new Set([
  '500', // INTERNAL_ERROR
]);

// ── Wire shapes (mode-2 `print`) ────────────────────────────────────────────

export interface EHdmPrintItem {
  adgCode: string;
  dep: string | null;
  goodCode: string | null;
  goodName: string;
  /** 3dp string. */
  quantity: string;
  unit: string | null;
  /** 2dp per-unit string. */
  price: string;
}

export interface EHdmPrintRequest {
  crn: string;
  cardAmount: string;
  cashAmount: string;
  partialAmount: string;
  prePaymentAmount: string;
  cashierId: string;
  mode: number;
  partnerTin: string | null;
  items: EHdmPrintItem[];
}

export interface EHdmResult {
  receiptId: string | number;
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
}

export interface EHdmResponse {
  code: number;
  message?: string;
  errorMessage?: string;
  result?: EHdmResult;
}

// ── Mapping (domain → wire) ──────────────────────────────────────────────────

/**
 * Build the mode-2 `print` request. PRE-FLIGHT FAIL-CLOSED: any line missing an
 * `adgCode` throws a FATAL-config 192 (ADG_CODE_REQUIRED) BEFORE any SRC call —
 * SRC would reject it anyway (192), and looping would never self-heal. Money is
 * rendered 2dp, quantity 3dp, at this wire boundary only (the VOs never re-round).
 */
export function buildPrintPayload(
  input: FiscalizationInput,
  cfg: TenantFiscalConfig,
): EHdmPrintRequest {
  // FISCAL-4: a line's `dep` comes from the tenant's department map (dep -> tax
  // regime). Single-department tenants get that one dep; a line that already
  // carries an explicit dep keeps it. Per-line dep routing (menu-item -> dep) is a
  // follow-up. Deterministic: lowest dep code when several exist.
  const defaultDep = Object.keys(cfg.departmentMap).sort()[0] ?? null;
  const items: EHdmPrintItem[] = input.lines.map((line) => {
    if (line.adgCode === null || line.adgCode.trim() === '') {
      throw new FatalFiscalError(
        '192',
        `ADG_CODE_REQUIRED: line "${line.goodName}" has no adgCode (fail closed pre-flight).`,
      );
    }
    return {
      adgCode: line.adgCode,
      dep: line.dep ?? defaultDep,
      goodCode: line.goodCode,
      goodName: line.goodName,
      quantity: Quantity.fromThousandths(line.quantityThousandths).toDecimalString(),
      unit: line.unit,
      price: Money.fromMinorUnits(line.unitPriceAmount).toDecimalString(),
    };
  });

  return {
    crn: cfg.crn,
    cardAmount: Money.fromMinorUnits(input.cardAmount).toDecimalString(),
    cashAmount: Money.fromMinorUnits(input.cashAmount).toDecimalString(),
    partialAmount: Money.fromMinorUnits(input.partialAmount).toDecimalString(),
    prePaymentAmount: Money.fromMinorUnits(input.prePaymentAmount).toDecimalString(),
    cashierId: cfg.cashierId,
    mode: input.mode,
    partnerTin: input.partnerTin,
    items,
  };
}

// ── Parsing (wire → domain) ──────────────────────────────────────────────────

/** Parse an SRC 2dp money value ("12.34" or 1234-as-number-of-drams) to minor units. */
function toMinorUnits(value: string | number | undefined, fallback: number): number {
  if (value === undefined || value === null) {
    return fallback;
  }
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) {
    return fallback;
  }
  // SRC renders money as a 2dp decimal amount; our domain grain is minor units.
  return Money.roundHalfUp(n * 100).minorUnits;
}

/** Map a successful SRC `result` onto the port's FiscalizationResult (incl. `sn`, `qr`). */
export function parsePrintResponse(
  result: EHdmResult,
  input: FiscalizationInput,
): FiscalizationResult {
  const epochMs = Number(result.time);
  const issuedAt = new Date(Number.isFinite(epochMs) ? epochMs : Date.now());
  const fiscal = String(result.fiscal);
  return {
    receiptId: String(result.receiptId),
    fiscalReference: fiscal, // back-compat with ORDER-1
    fiscalNumber: fiscal,
    sn: String(result.sn), // returned; ConfirmPayment does not persist it (decision C)
    qr: result.qr,
    issuedAtEpochMs: Number.isFinite(epochMs) ? epochMs : issuedAt.getTime(),
    totalAmount: toMinorUnits(result.total, input.totalAmount),
    changeAmount: toMinorUnits(result.change, input.changeAmount),
    issuedAt,
  };
}

// ── Error classification ─────────────────────────────────────────────────────

/**
 * Throw the right error type for a non-zero SRC response code. RETRYABLE (network
 * / 500 / explicit transient) → ordinary Error, which ConfirmPayment leaves as the
 * derived paid-but-unfiscalized retry state. Otherwise → FatalFiscalError(code),
 * which ConfirmPayment records on Order.fiscalError to STOP the loop (decision E).
 */
export function classifyAndThrow(code: number | string, message: string): never {
  const c = String(code);
  if (RETRYABLE_FISCAL_CODES.has(c)) {
    throw new Error(`e-HDM transient error ${c}: ${message}`);
  }
  throw new FatalFiscalError(c, `e-HDM fatal-config error ${c}: ${message}`);
}
