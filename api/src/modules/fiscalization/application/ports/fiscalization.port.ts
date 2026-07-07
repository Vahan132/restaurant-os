/** DI token for the FiscalizationPort. */
export const FISCALIZATION_PORT = Symbol('FiscalizationPort');

/**
 * `mode` on the fiscal receipt (SRC e-HDM `print` modes):
 *   2 = products receipt, 3 = prepayment receipt.
 * QR-web v1 fiscalises the paid products receipt (mode 2) — see the accountant
 * decision NOTE in the fiscalization trigger.
 */
export enum FiscalMode {
  PRODUCTS = 2,
  PREPAYMENT = 3,
}

/**
 * A single receipt line, summarised for fiscalization. Shaped against the SRC
 * e-HDM `print` mode-2 per-line contract; the fields that v1 does not populate
 * (`adgCode`, `dep`, discounts, `emarks`) are reserved nullable so the real
 * e-HDM adapter (roadmap #6) can send them without a shape change.
 */
export interface FiscalizationLine {
  /** Human-readable item name (snapshot). Mirrors `goodName`. */
  name: string;
  /** SRC `goodName` — the fiscal good name (snapshot at order time). */
  goodName: string;
  /** SRC `goodCode` — internal good code (snapshot). Null when not catalogued. */
  goodCode: string | null;
  /** SRC quantity, integer thousandths (3dp). */
  quantityThousandths: number;
  /** SRC `unit` (e.g. "pcs", "kg"). Null until the catalog carries units. */
  unit: string | null;
  /** Unit price in integer minor units. */
  unitPriceAmount: number;
  /** Line total in integer minor units (after modifiers/discounts). */
  lineTotalAmount: number;
  /** RESERVED (fiscal-ready, unused in v1): ATG code — sourced in catalog / #6. */
  adgCode: string | null;
  /** RESERVED: department. */
  dep: string | null;
}

/**
 * Payment/receipt-shaped input to fiscalization. Device-agnostic: the e-HDM vs
 * physical-HDM specifics (TLS, .jks, TCP, `ecrm.taxservice.am`) belong to the
 * real adapters, never here. `channel` lets a later adapter-router pick e-HDM
 * (QR_WEB/APP) vs physical HDM (POS); the stub ignores it.
 */
export interface FiscalizationInput {
  restaurantId: string;
  branchId: string;
  /** The order (or settlement) this fiscal receipt is for. */
  orderRef: string;
  currency: string;
  /** Origin channel (QR_WEB / APP / POS) — drives adapter routing at #6. */
  channel: string;
  /** Receipt mode: 2 = products, 3 = prepayment. */
  mode: FiscalMode;
  /** Buyer TIN for a partner receipt, or null (out of scope v1). */
  partnerTin: string | null;
  lines: FiscalizationLine[];
  /** Totals in integer minor units. */
  subtotalAmount: number;
  discountAmount: number;
  serviceFeeAmount: number;
  totalAmount: number;
  /** Tender split (integer minor units). QR v1: card only, others 0. */
  cardAmount: number;
  cashAmount: number;
  partialAmount: number;
  prePaymentAmount: number;
  changeAmount: number;
}

/** Receipt identifiers returned by the fiscal device / authority. */
export interface FiscalizationResult {
  /** Provider/device receipt id (SRC `receiptId`). */
  receiptId: string;
  /** Fiscal serial / crypto reference (kept for back-compat with ORDER-1). */
  fiscalReference: string;
  /** SRC `fiscal` — the fiscal number printed on the receipt. */
  fiscalNumber: string;
  /** SRC `sn` — device serial number. */
  sn: string;
  /** SRC `qr` — fixed-format string the customer receipt renders as a QR code. */
  qr: string;
  /** SRC `time` — issue time as a GMT epoch in milliseconds. */
  issuedAtEpochMs: number;
  /** SRC `total` — echoed receipt total (integer minor units). */
  totalAmount: number;
  /** SRC `change` — change returned (integer minor units). */
  changeAmount: number;
  /** When the fiscal receipt was issued (Date form of `issuedAtEpochMs`). */
  issuedAt: Date;
}

/**
 * The single fiscalization seam every payment/receipt step plugs into. Two real
 * adapters (physical HDM over TCP, electronic HDM over mTLS) land in the
 * fiscalization workstream (#6); call sites depend only on this port + its DI
 * token. Extended for ORDER-2 (mode/channel/partnerTin/tender split + qr result)
 * now that the SRC manuals are read — still fully device-agnostic.
 */
export interface FiscalizationPort {
  fiscalize(input: FiscalizationInput): Promise<FiscalizationResult>;
}
