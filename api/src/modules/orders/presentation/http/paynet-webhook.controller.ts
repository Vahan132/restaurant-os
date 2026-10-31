import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../../../shared/auth/public.decorator';
import { verifyPaynetSignature } from '../../../payment/infrastructure/paynet/paynet.client';
import { PaymentProviderConfigStore } from '../../../payment/infrastructure/persistence/payment-provider-config.store';
import { ConfirmPaymentUseCase } from '../../application/commands/confirm-payment.usecase';

interface PaynetWebhookBody {
  delivery_id?: string;
  event?: string;
  livemode?: boolean;
  transaction?: { order_id?: string; status?: string; uuid?: string } | null;
}

/**
 * PAYNET-1 — Paynet webhook receiver. One URL per branch config
 * (`/public/payments/paynet/webhook/:configId`) so we know WHICH merchant's secret
 * signs it. Flow (per Paynet's guide): verify the HMAC over the RAW body → answer
 * 200 fast → then settle via ConfirmPayment, which RE-READS the payment from
 * Paynet (never trusts the webhook body) and is idempotent, so duplicates and
 * out-of-order deliveries are harmless.
 */
@ApiExcludeController()
@Public()
@Controller('public/payments/paynet/webhook')
export class PaynetWebhookController {
  private readonly logger = new Logger(PaynetWebhookController.name);

  constructor(
    private readonly configs: PaymentProviderConfigStore,
    private readonly confirm: ConfirmPaymentUseCase,
  ) {}

  @Post(':configId')
  @HttpCode(200)
  async receive(
    @Param('configId') configId: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paynet-signature') signature?: string,
    @Headers('x-paynet-signature-next') signatureNext?: string,
  ): Promise<{ ok: true }> {
    const cfg = await this.configs.getSecretsById(configId);
    const raw = req.rawBody;
    if (!cfg || !cfg.webhookSecret || !raw) {
      // Unknown config / no secret saved / raw body unavailable: refuse (Paynet retries).
      throw new UnauthorizedException({ code: 'WEBHOOK_REJECTED', message: 'Rejected.' });
    }
    if (!verifyPaynetSignature(raw, cfg.webhookSecret, signature, signatureNext)) {
      throw new UnauthorizedException({ code: 'WEBHOOK_BAD_SIGNATURE', message: 'Bad signature.' });
    }

    const body = (req.body ?? {}) as PaynetWebhookBody;
    const orderId = body.transaction?.order_id;
    if (
      body.event === 'transaction.status.updated' &&
      body.transaction?.status === 'completed' &&
      typeof orderId === 'string' &&
      !orderId.startsWith('restos-test-')
    ) {
      // Respond now; settle in the background (fiscalisation can take seconds).
      setImmediate(() => {
        this.confirm
          .execute({
            restaurantId: cfg.restaurantId,
            branchId: cfg.branchId,
            sessionId: null,
            orderId,
          })
          .catch((err: Error) =>
            this.logger.warn(
              `Paynet webhook settle failed order=${orderId} delivery=${body.delivery_id ?? '-'}: ${err.message}`,
            ),
          );
      });
    }
    return { ok: true };
  }
}
