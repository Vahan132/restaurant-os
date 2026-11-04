import { BadGatewayException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import {
  OnlineCheckoutPort,
  PaymentChargeInput,
  PaymentChargeResult,
  PaymentPort,
  StartCheckoutInput,
  StartCheckoutResult,
} from '../../application/ports/payment.port';
import {
  fromPaynetAmount,
  PaynetApiError,
  PaynetClient,
  toPaynetAmount,
} from '../paynet/paynet.client';
import { PaymentProviderConfigStore } from '../persistence/payment-provider-config.store';
import { StubPaymentAdapter } from './stub-payment.adapter';

/** Paynet payment path for OUR order id (Idempotency + lookups key on it). */
export const paynetWebhookPath = (configId: string): string =>
  `/public/payments/paynet/webhook/${configId}`;

/**
 * PAYNET-1 — routes by branch: a branch with an ACTIVE Paynet config uses Paynet
 * (hosted checkout + verify); otherwise the stub (only when PAYMENT_ALLOW_STUB).
 *
 * `charge()` is the VERIFY step: it never moves money itself — it reads Paynet's
 * latest payment for the order and checks status AND amount against the
 * server-authoritative order total, so neither a forged return redirect nor a
 * tampered amount can mark an order paid.
 */
@Injectable()
export class RoutingPaymentAdapter implements PaymentPort, OnlineCheckoutPort {
  private readonly logger = new Logger(RoutingPaymentAdapter.name);
  private readonly client: PaynetClient;

  constructor(
    private readonly store: PaymentProviderConfigStore,
    private readonly stub: StubPaymentAdapter,
    private readonly config: ConfigService<AppConfig, true>,
  ) {
    this.client = new PaynetClient(config.get('PAYNET_BASE_URL', { infer: true }) as string);
  }

  async startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult> {
    const cfg = await this.store.getActiveSecrets(input.restaurantId, input.branchId);
    if (!cfg) {
      this.assertStubAllowed();
      return { status: 'DIRECT' };
    }
    // Already paid on Paynet (e.g. buyer paid, closed the tab, came back)?
    try {
      const existing = await this.client.getOrderPayment(cfg.apiKey, input.orderRef);
      if (existing.status === 'completed') {
        return { status: 'ALREADY_PAID' };
      }
    } catch (err) {
      if (!(err instanceof PaynetApiError && err.status === 404)) {
        throw this.gatewayError(err);
      }
    }

    const publicApi = this.config.get('PUBLIC_API_URL', { infer: true }) as string | undefined;
    try {
      const payment = await this.client.createPayment(
        cfg.apiKey,
        {
          amount: toPaynetAmount(input.amount),
          currency: input.currency || 'AMD',
          order_id: input.orderRef,
          return_url: input.returnUrl,
          cancel_url: input.returnUrl,
          ...(publicApi
            ? { callback_url: publicApi.replace(/\/+$/, '') + paynetWebhookPath(cfg.id) }
            : {}),
          ...(cfg.processor ? { processor: cfg.processor } : {}),
          ...(cfg.domain ? { domain: cfg.domain } : {}),
          ...(input.description ? { description: input.description } : {}),
        },
        // Dedupe double-taps within ~30s; a later retry gets a fresh payment
        // (Paynet supersedes the older unpaid attempt for the same order).
        `${input.orderRef}:${Math.floor(Date.now() / 30_000)}`,
      );
      if (!payment.checkout_url) {
        throw new PaynetApiError(502, 'no_checkout_url', 'Paynet returned no checkout_url.');
      }
      return { status: 'REDIRECT', checkoutUrl: payment.checkout_url, providerRef: payment.uuid };
    } catch (err) {
      throw this.gatewayError(err);
    }
  }

  async charge(input: PaymentChargeInput): Promise<PaymentChargeResult> {
    const cfg = await this.store.getActiveSecrets(input.restaurantId, input.branchId);
    if (!cfg) {
      this.assertStubAllowed();
      return this.stub.charge(input);
    }
    let payment;
    try {
      payment = await this.client.getOrderPayment(cfg.apiKey, input.orderRef);
    } catch (err) {
      if (err instanceof PaynetApiError && err.status === 404) {
        return { reference: '', status: 'DECLINED', amount: 0 };
      }
      throw this.gatewayError(err);
    }
    const reference = `PAYNET-${payment.uuid}`;
    switch (payment.status) {
      case 'completed': {
        const paid = fromPaynetAmount(payment.amount);
        if (paid !== input.amount) {
          // Never settle a payment whose amount differs from the order total.
          this.logger.error(
            `Paynet amount mismatch order=${input.orderRef} paid=${paid} expected=${input.amount}`,
          );
          return { reference, status: 'DECLINED', amount: paid };
        }
        return { reference, status: 'CAPTURED', amount: paid };
      }
      case 'pending':
      case 'processing':
        return { reference, status: 'PENDING', amount: 0 };
      default:
        // failed / expired / refunded / unknown
        return { reference, status: 'DECLINED', amount: 0 };
    }
  }

  private assertStubAllowed(): void {
    if (!this.config.get('PAYMENT_ALLOW_STUB', { infer: true })) {
      throw new ConflictException({
        code: 'ONLINE_PAYMENT_NOT_CONFIGURED',
        message: 'Online payment is not set up for this restaurant yet.',
      });
    }
  }

  private gatewayError(err: unknown): Error {
    if (err instanceof PaynetApiError) {
      this.logger.warn(`Paynet error ${err.status} ${err.code} req=${err.requestId ?? '-'}`);
      return new BadGatewayException({
        code: 'PAYMENT_GATEWAY_ERROR',
        message: 'The payment service is unavailable right now. Please try again.',
        details: { provider: 'paynet', code: err.code, requestId: err.requestId },
      });
    }
    return err as Error;
  }
}
