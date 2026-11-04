/**
 * FISCAL-0: thrown by a FiscalizationPort adapter when the fiscal authority
 * returns a FATAL-config error (e.g. SRC 403 UNAUTHORIZED_CONNECTION, 183
 * INVALID_ADG_CODE, 192 ADG_CODE_REQUIRED, 199 BLOCKED_CERT_CRM, 106/107
 * cert-CRN mismatch) — a condition that retrying cannot fix.
 *
 * ConfirmPayment catches this, records the code on the order (Order.fiscalError)
 * to STOP the recoverable retry loop, and surfaces it to the operator. A
 * RETRYABLE failure (network / 500 / transient) must be thrown as an ordinary
 * Error instead, so the paid-but-unfiscalized state drives a later retry. The
 * stub adapter never throws this; the SRC-code -> fatal|retryable classifier
 * that decides which to throw lands in FISCAL-1.
 */
export class FatalFiscalError extends Error {
  constructor(
    /** The SRC error code (e.g. "192", "403"), persisted as Order.fiscalError. */
    readonly code: string,
    message?: string,
  ) {
    super(message ?? `Fatal fiscalization error (${code}).`);
    this.name = 'FatalFiscalError';
  }
}
