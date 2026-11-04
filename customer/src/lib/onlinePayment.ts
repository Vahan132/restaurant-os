/**
 * PAYNET-1 — hosted-checkout helpers for the QR prepayment flow.
 *
 *   pay → create order → start-payment
 *     REDIRECT → browser goes to Paynet; Paynet sends the guest back to this page
 *                with `?paynet_order=<orderId>` → confirm-payment (the server
 *                re-reads Paynet; the redirect alone is never trusted).
 *     CONFIRM  → no online provider (dev/stub) or already paid → confirm now.
 *
 * Hand-written (not orval) until the next client regeneration.
 */
import { customInstance } from '@/api/mutator';

export const RETURN_PARAM = 'paynet_order';

export interface StartPaymentResponse {
  mode: 'REDIRECT' | 'CONFIRM';
  checkoutUrl: string | null;
}

function unwrap<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'data' in body && !('mode' in body)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export async function startPayment(orderId: string, returnUrl: string): Promise<StartPaymentResponse> {
  const body = await customInstance<unknown>({
    url: `/public/qr/orders/${encodeURIComponent(orderId)}/start-payment`,
    method: 'POST',
    data: { returnUrl },
  });
  return unwrap<StartPaymentResponse>(body);
}

/** This page's URL with `?paynet_order=<orderId>` (any previous one replaced). */
export function buildReturnUrl(orderId: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set(RETURN_PARAM, orderId);
  url.hash = '';
  return url.toString();
}

/** The order id Paynet returned us for, if this page load is a payment return. */
export function readReturnOrderId(): string | null {
  if (typeof window === 'undefined') return null;
  return new URL(window.location.href).searchParams.get(RETURN_PARAM);
}

/** Drop the return marker so a refresh doesn't re-run the return flow. */
export function clearReturnParam(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(RETURN_PARAM)) return;
  url.searchParams.delete(RETURN_PARAM);
  window.history.replaceState(window.history.state, '', url.toString());
}
