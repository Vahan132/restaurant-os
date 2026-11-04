import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import { paynetWebhookPath } from '../../infrastructure/adapters/routing-payment.adapter';
import { PaynetApiError, PaynetClient } from '../../infrastructure/paynet/paynet.client';
import {
  PaymentConfigError,
  PaymentProviderConfigStore,
  PaymentProviderStatus,
  UpsertPaynetConfigInput,
} from '../../infrastructure/persistence/payment-provider-config.store';

export interface PaymentSettingsView {
  status: PaymentProviderStatus | null;
  /** Where Paynet should POST webhooks for this branch (null until PUBLIC_API_URL + a row exist). */
  webhookUrl: string | null;
}

export interface PaymentCheckResult {
  ok: boolean;
  livemode: boolean;
  errorCode: string | null;
  errorMessage: string | null;
}

/** Plain-language hints for the codes a restaurant owner meets while setting up. */
const HINTS: Record<string, string> = {
  invalid_api_key: 'The secret key is wrong or was deleted in the Paynet dashboard.',
  missing_credentials: 'No secret key saved.',
  VERIFICATION_REQUIRED: 'Live payments need a verified business in the Paynet dashboard.',
  BALANCE_EXHAUSTED: 'The Paynet transaction balance is used up — top it up in the dashboard.',
  network_error: 'Paynet could not be reached from the server.',
  domain_not_registered: 'This website is not a verified domain in your Paynet account.',
  domain_mismatch: 'The return address is not on a verified Paynet domain.',
  no_payment_method_configured:
    'Turn on at least one payment method (card, Idram, Telcell) in Paynet.',
};

/**
 * PAYNET-1 — restaurant-owner "Online payments" settings: save keys (write-only),
 * test the key, and open a sandbox test payment.
 */
@Injectable()
export class PaymentSettingsService {
  private readonly client: PaynetClient;

  constructor(
    private readonly store: PaymentProviderConfigStore,
    private readonly config: ConfigService<AppConfig, true>,
  ) {
    this.client = new PaynetClient(config.get('PAYNET_BASE_URL', { infer: true }) as string);
  }

  async get(restaurantId: string, branchId: string): Promise<PaymentSettingsView> {
    const status = await this.store.getStatus(restaurantId, branchId);
    return { status, webhookUrl: status ? this.webhookUrl(status.id) : null };
  }

  async save(input: UpsertPaynetConfigInput): Promise<PaymentSettingsView> {
    try {
      await this.store.upsert(input);
    } catch (err) {
      if (err instanceof PaymentConfigError) {
        throw new BadRequestException({ code: err.code, message: err.message });
      }
      throw err;
    }
    return this.get(input.restaurantId, input.branchId);
  }

  /**
   * Verify the key with a harmless read: the latest payment for an order id that
   * cannot exist. 404 `order_not_found` = key accepted; 401 = bad key.
   */
  async check(restaurantId: string, branchId: string): Promise<PaymentCheckResult> {
    const cfg = await this.store.getSecrets(restaurantId, branchId);
    if (!cfg) {
      throw new ConflictException({
        code: 'PAYNET_KEY_REQUIRED',
        message: 'Save the Paynet secret key first.',
      });
    }
    let result: PaymentCheckResult;
    try {
      await this.client.getOrderPayment(cfg.apiKey, `restos-check-${Date.now()}`);
      result = { ok: true, livemode: cfg.livemode, errorCode: null, errorMessage: null };
    } catch (err) {
      if (err instanceof PaynetApiError && err.status === 404) {
        result = { ok: true, livemode: cfg.livemode, errorCode: null, errorMessage: null };
      } else if (err instanceof PaynetApiError) {
        result = {
          ok: false,
          livemode: cfg.livemode,
          errorCode: err.code,
          errorMessage: HINTS[err.code] ?? err.message,
        };
      } else {
        throw err;
      }
    }
    await this.store.recordCheck(restaurantId, branchId, result.ok, result.errorCode);
    return result;
  }

  /** Sandbox-only end-to-end test: returns a checkout URL to pay with test cards. */
  async testPayment(
    restaurantId: string,
    branchId: string,
    amountAmd: number,
    returnUrl: string,
  ): Promise<{ checkoutUrl: string; uuid: string }> {
    const cfg = await this.store.getSecrets(restaurantId, branchId);
    if (!cfg) {
      throw new ConflictException({
        code: 'PAYNET_KEY_REQUIRED',
        message: 'Save the Paynet secret key first.',
      });
    }
    if (cfg.livemode) {
      throw new ConflictException({
        code: 'PAYNET_TEST_KEY_ONLY',
        message:
          'Test payments are only allowed with a sk_test_ key (a live key would charge real money).',
      });
    }
    try {
      const p = await this.client.createPayment(cfg.apiKey, {
        amount: amountAmd,
        order_id: `restos-test-${Date.now()}`,
        return_url: returnUrl,
        description: 'Restaurant OS test payment',
        ...(cfg.processor ? { processor: cfg.processor } : {}),
      });
      return { checkoutUrl: p.checkout_url ?? '', uuid: p.uuid };
    } catch (err) {
      if (err instanceof PaynetApiError) {
        throw new BadRequestException({
          code: `PAYNET_${err.code}`,
          message: HINTS[err.code] ?? err.message,
        });
      }
      throw err;
    }
  }

  private webhookUrl(configId: string): string | null {
    const base = this.config.get('PUBLIC_API_URL', { infer: true }) as string | undefined;
    return base ? base.replace(/\/+$/, '') + paynetWebhookPath(configId) : null;
  }
}
