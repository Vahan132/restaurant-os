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

/**
 * CAPTURED = money is in; DECLINED = no (or a failed/expired) payment;
 * PENDING (PAYNET-1) = a hosted-checkout payment exists but the buyer has not
 * finished it yet — the caller must NOT settle and should ask to retry shortly.
 */
export type PaymentChargeStatus = 'CAPTURED' | 'DECLINED' | 'PENDING';

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

// ── PAYNET-1: hosted checkout (redirect) ─────────────────────────────────────

/** DI token for the OnlineCheckoutPort. */
export const ONLINE_CHECKOUT_PORT = Symbol('OnlineCheckoutPort');

export interface StartCheckoutInput {
  restaurantId: string;
  branchId: string;
  orderRef: string;
  currency: string;
  /** Integer minor units (server-authoritative order total). */
  amount: number;
  /** Where the provider sends the buyer back (our QR page). */
  returnUrl: string;
  description?: string;
}

export type StartCheckoutResult =
  /** Redirect the buyer to the provider's hosted checkout. */
  | { status: 'REDIRECT'; checkoutUrl: string; providerRef: string }
  /** The provider already holds a completed payment for this order — just confirm. */
  | { status: 'ALREADY_PAID' }
  /** No online provider configured for this branch — confirm directly (stub/dev). */
  | { status: 'DIRECT' };

/**
 * Redirect-based online payment seam. `charge()` on the PaymentPort then acts as
 * the VERIFY step (reads the provider's truth for the order) when the buyer
 * comes back or a webhook arrives.
 */
export interface OnlineCheckoutPort {
  startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult>;
}
