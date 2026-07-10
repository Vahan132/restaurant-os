/** DI token for the PaymentPort. */
export const PAYMENT_PORT = Symbol('PaymentPort');

/**
 * A prepayment charge request. `idempotencyKey` (the order id in QR-web v1) lets
 * the gateway de-duplicate a retried charge; the real gateway would key its
 * capture on it. Amount is integer minor units.
 */
export interface PaymentChargeInput {
  restaurantId: string;
  branchId: string;
  /** The order this charge settles. */
  orderRef: string;
  currency: string;
  /** Integer minor units. */
  amount: number;
  /** Idempotency key (order id in v1) — a retried charge must not double-capture. */
  idempotencyKey: string;
}

export type PaymentChargeStatus = 'CAPTURED' | 'DECLINED';

/** Result of a prepayment charge. */
export interface PaymentChargeResult {
  /** Provider charge reference (persisted on the order for traceability). */
  reference: string;
  status: PaymentChargeStatus;
  /** Captured amount in integer minor units (echo of the request on CAPTURED). */
  amount: number;
}

/**
 * The single payment seam the ordering flow plugs into. The real card gateway
 * lands later; call sites depend only on this port + its DI token, exactly like
 * {@link FISCALIZATION_PORT}. Card-present / 3DS / webhooks are gateway concerns,
 * never modelled here.
 */
export interface PaymentPort {
  charge(input: PaymentChargeInput): Promise<PaymentChargeResult>;
}
