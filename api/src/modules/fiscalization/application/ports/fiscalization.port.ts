/** DI token for the FiscalizationPort. */
export const FISCALIZATION_PORT = Symbol('FiscalizationPort');

/** A single receipt line, summarised for fiscalization. */
export interface FiscalizationLine {
  /** Human-readable item name (snapshot). */
  name: string;
  quantity: number;
  /** Unit price in integer minor units. */
  unitPriceAmount: number;
  /** Line total in integer minor units (after modifiers/discounts). */
  lineTotalAmount: number;
}

/**
 * Payment/receipt-shaped input to fiscalization. Deliberately minimal and device
 * -agnostic: the e-HDM vs physical-HDM specifics belong to the real adapters (a
 * later workstream), never here.
 */
export interface FiscalizationInput {
  restaurantId: string;
  branchId: string;
  /** The order (or settlement) this fiscal receipt is for. */
  orderRef: string;
  currency: string;
  lines: FiscalizationLine[];
  /** Totals in integer minor units. */
  subtotalAmount: number;
  discountAmount: number;
  serviceFeeAmount: number;
  totalAmount: number;
}

/** Receipt identifiers returned by the fiscal device / authority. */
export interface FiscalizationResult {
  /** Provider/device receipt id (e.g. e-HDM fiscal number). */
  receiptId: string;
  /** Fiscal serial / crypto reference where applicable. */
  fiscalReference: string;
  /** When the fiscal receipt was issued. */
  issuedAt: Date;
}

/**
 * The single fiscalization seam every later payment/receipt step plugs into.
 * Two real adapters (physical HDM over TCP, electronic HDM over mTLS) land in the
 * fiscalization workstream; call sites depend only on this port + its DI token.
 */
export interface FiscalizationPort {
  fiscalize(input: FiscalizationInput): Promise<FiscalizationResult>;
}
