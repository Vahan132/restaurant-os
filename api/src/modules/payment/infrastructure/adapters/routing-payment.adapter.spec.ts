import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { fromPaynetAmount, toPaynetAmount, verifyPaynetSignature } from '../paynet/paynet.client';
import {
  PaymentProviderConfigStore,
  PaynetSecrets,
} from '../persistence/payment-provider-config.store';
import { RoutingPaymentAdapter } from './routing-payment.adapter';
import { StubPaymentAdapter } from './stub-payment.adapter';

/** PAYNET-1 — verify step + webhook signature (no network: fetch is mocked). */

const SECRETS: PaynetSecrets = {
  id: 'cfg1',
  restaurantId: 'r1',
  branchId: 'b1',
  enabled: true,
  livemode: false,
  apiKey: 'sk_test_abcdefgh',
  webhookSecret: 'whsec',
  domain: null,
  processor: null,
};

function makeAdapter(secrets: PaynetSecrets | null, env: Record<string, unknown> = {}) {
  const store = {
    getActiveSecrets: jest.fn().mockResolvedValue(secrets),
  } as unknown as PaymentProviderConfigStore;
  const config = {
    get: (k: string) =>
      ({ PAYNET_BASE_URL: 'https://paynet.test', PAYMENT_ALLOW_STUB: true, ...env })[k],
  } as unknown as ConfigService;
  return new RoutingPaymentAdapter(store, new StubPaymentAdapter(), config as never);
}

function mockFetch(status: number, body: unknown) {
  return jest
    .spyOn(global, 'fetch')
    .mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
}

const CHARGE = {
  restaurantId: 'r1',
  branchId: 'b1',
  orderRef: 'ord1',
  currency: 'AMD',
  amount: 1_500_000, // 15000.00 AMD
  idempotencyKey: 'ord1',
};

afterEach(() => jest.restoreAllMocks());

describe('Paynet helpers', () => {
  it('converts minor units <-> dram', () => {
    expect(toPaynetAmount(1_500_000)).toBe(15000);
    expect(toPaynetAmount(62995)).toBe(629.95);
    expect(fromPaynetAmount('629.95')).toBe(62995);
    expect(Number.isNaN(fromPaynetAmount(undefined))).toBe(true);
  });

  it('verifies the hex HMAC over the RAW body (and the rotation header)', () => {
    const raw = Buffer.from('{"event":"transaction.status.updated"}');
    const sig = createHmac('sha256', 'whsec').update(raw).digest('hex');
    expect(verifyPaynetSignature(raw, 'whsec', sig)).toBe(true);
    expect(verifyPaynetSignature(raw, 'whsec', 'bad', sig)).toBe(true);
    expect(verifyPaynetSignature(raw, 'other', sig)).toBe(false);
    expect(verifyPaynetSignature(Buffer.from(raw.toString() + ' '), 'whsec', sig)).toBe(false);
    expect(verifyPaynetSignature(raw, 'whsec', undefined)).toBe(false);
  });
});

describe('RoutingPaymentAdapter.charge (verify)', () => {
  it('falls back to the stub when the branch has no Paynet config', async () => {
    const res = await makeAdapter(null).charge(CHARGE);
    expect(res.status).toBe('CAPTURED');
    expect(res.reference).toMatch(/^STUBPAY-/);
  });

  it('refuses the stub when PAYMENT_ALLOW_STUB=false', async () => {
    await expect(
      makeAdapter(null, { PAYMENT_ALLOW_STUB: false }).charge(CHARGE),
    ).rejects.toMatchObject({
      response: { code: 'ONLINE_PAYMENT_NOT_CONFIGURED' },
    });
  });

  it('CAPTURED only when completed AND the amount matches the order total', async () => {
    mockFetch(200, { uuid: 'u1', order_id: 'ord1', status: 'completed', amount: 15000 });
    await expect(makeAdapter(SECRETS).charge(CHARGE)).resolves.toMatchObject({
      status: 'CAPTURED',
      reference: 'PAYNET-u1',
      amount: 1_500_000,
    });
  });

  it('DECLINED on an amount mismatch (tampered/partial payment)', async () => {
    mockFetch(200, { uuid: 'u1', order_id: 'ord1', status: 'completed', amount: 100 });
    await expect(makeAdapter(SECRETS).charge(CHARGE)).resolves.toMatchObject({
      status: 'DECLINED',
    });
  });

  it('PENDING while the buyer is still at the provider', async () => {
    mockFetch(200, { uuid: 'u1', order_id: 'ord1', status: 'processing', amount: 15000 });
    await expect(makeAdapter(SECRETS).charge(CHARGE)).resolves.toMatchObject({ status: 'PENDING' });
  });

  it('DECLINED when Paynet has no payment for the order (404)', async () => {
    mockFetch(404, { error: 'order_not_found', message: 'nope' });
    await expect(makeAdapter(SECRETS).charge(CHARGE)).resolves.toMatchObject({
      status: 'DECLINED',
    });
  });

  it('sends the secret key as a Bearer token to /orders/{id}/payment', async () => {
    const spy = mockFetch(200, { uuid: 'u1', order_id: 'ord1', status: 'failed', amount: 15000 });
    await makeAdapter(SECRETS).charge(CHARGE);
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://paynet.test/api/v1/orders/ord1/payment');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk_test_abcdefgh');
  });
});

describe('RoutingPaymentAdapter.startCheckout', () => {
  it('creates a payment with the server total and returns the checkout URL', async () => {
    const spy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'order_not_found' }), { status: 404 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            uuid: 'u9',
            checkout_url: 'https://paynet.test/c/u9',
            status: 'pending',
          }),
          {
            status: 201,
          },
        ),
      );
    const res = await makeAdapter(SECRETS, {
      PUBLIC_API_URL: 'https://api.example.am/res/api/',
    }).startCheckout({
      restaurantId: 'r1',
      branchId: 'b1',
      orderRef: 'ord1',
      currency: 'AMD',
      amount: 1_500_000,
      returnUrl: 'https://menu.example.am/t/1?paynet_order=ord1',
    });
    expect(res).toEqual({
      status: 'REDIRECT',
      checkoutUrl: 'https://paynet.test/c/u9',
      providerRef: 'u9',
    });
    const body = JSON.parse((spy.mock.calls[1][1] as RequestInit).body as string);
    expect(body).toMatchObject({
      amount: 15000,
      order_id: 'ord1',
      currency: 'AMD',
      callback_url: 'https://api.example.am/res/api/public/payments/paynet/webhook/cfg1',
    });
  });

  it('DIRECT when no provider is configured', async () => {
    await expect(
      makeAdapter(null).startCheckout({
        restaurantId: 'r1',
        branchId: 'b1',
        orderRef: 'o',
        currency: 'AMD',
        amount: 1,
        returnUrl: 'https://x.am',
      }),
    ).resolves.toEqual({ status: 'DIRECT' });
  });
});
