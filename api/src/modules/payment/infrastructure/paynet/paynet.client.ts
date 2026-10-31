import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * PAYNET-1 — minimal Paynet.am REST client (API v1, https://paynet.am/docs/api).
 * Stateless: every call takes the merchant's own secret key (each restaurant
 * uses ITS OWN Paynet account). Amounts on the wire are dram with up to 2
 * decimals; this client takes/returns them as numbers and leaves minor-unit
 * conversion to the caller. Never logs the key.
 */

export type PaynetPaymentStatus =
  'pending' | 'processing' | 'completed' | 'failed' | 'expired' | 'refunded';

export interface PaynetPayment {
  uuid: string;
  order_id: string;
  status: PaynetPaymentStatus | string;
  amount: number | string;
  refunded_amount?: number | string | null;
  currency?: string;
  processor?: string | null;
  checkout_url?: string;
  failure_code?: string | null;
  failure_message?: string | null;
  livemode?: boolean;
  completed_at?: string | null;
  created_at?: string;
}

export interface PaynetCreatePaymentInput {
  amount: number;
  order_id: string;
  return_url: string;
  currency?: string;
  cancel_url?: string;
  callback_url?: string;
  processor?: string;
  domain?: string;
  description?: string;
  customer_email?: string;
  customer_name?: string;
}

export class PaynetApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = 'PaynetApiError';
  }
}

const TIMEOUT_MS = 15_000;

export class PaynetClient {
  constructor(private readonly baseUrl = 'https://paynet.am') {}

  createPayment(
    apiKey: string,
    input: PaynetCreatePaymentInput,
    idempotencyKey?: string,
  ): Promise<PaynetPayment> {
    return this.call<PaynetPayment>(apiKey, 'POST', '/api/v1/payments', input, {
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    });
  }

  getPayment(apiKey: string, uuid: string): Promise<PaynetPayment> {
    return this.call<PaynetPayment>(apiKey, 'GET', `/api/v1/payments/${encodeURIComponent(uuid)}`);
  }

  /** Latest payment for one of OUR order ids; 404 `order_not_found` when none. */
  getOrderPayment(apiKey: string, orderId: string): Promise<PaynetPayment> {
    return this.call<PaynetPayment>(
      apiKey,
      'GET',
      `/api/v1/orders/${encodeURIComponent(orderId)}/payment`,
    );
  }

  refund(
    apiKey: string,
    uuid: string,
    idempotencyKey: string,
    amount?: number,
    reason?: string,
  ): Promise<Record<string, unknown>> {
    return this.call(
      apiKey,
      'POST',
      `/api/v1/payments/${encodeURIComponent(uuid)}/refund`,
      { ...(amount !== undefined ? { amount } : {}), ...(reason ? { reason } : {}) },
      { 'Idempotency-Key': idempotencyKey.slice(0, 120) },
    );
  }

  private async call<T>(
    apiKey: string,
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(this.baseUrl + path, {
        method,
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
          'Accept-Language': 'en',
          ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
      });
    } catch (err) {
      throw new PaynetApiError(0, 'network_error', `Paynet unreachable: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      // non-JSON error page
    }
    if (!res.ok) {
      throw new PaynetApiError(
        res.status,
        typeof data.error === 'string' ? data.error : `http_${res.status}`,
        typeof data.message === 'string' ? data.message : `Paynet HTTP ${res.status}`,
        typeof data.request_id === 'string' ? data.request_id : res.headers.get('x-request-id'),
      );
    }
    // Tolerate an optional `{ data: ... }` envelope.
    const inner =
      data.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : data;
    return inner as T;
  }
}

/**
 * Verify `X-Paynet-Signature` (lowercase hex HMAC-SHA256 of the RAW body with the
 * website's webhook secret). During a secret rotation `X-Paynet-Signature-Next`
 * carries the signature under the new secret — either one may match.
 */
export function verifyPaynetSignature(
  rawBody: Buffer,
  secret: string,
  signature: string | undefined,
  signatureNext?: string | undefined,
): boolean {
  const mine = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'), 'utf8');
  return [signature, signatureNext].some((h) => {
    if (!h) return false;
    const given = Buffer.from(h.trim().toLowerCase(), 'utf8');
    return given.length === mine.length && timingSafeEqual(given, mine);
  });
}

/** Minor units (integer, 2dp) → Paynet dram amount. */
export function toPaynetAmount(minorUnits: number): number {
  return Math.round(minorUnits) / 100;
}

/** Paynet dram amount (number or string) → minor units. */
export function fromPaynetAmount(amount: number | string | null | undefined): number {
  const n = typeof amount === 'number' ? amount : Number(amount ?? NaN);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}
