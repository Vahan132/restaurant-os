import { Module } from '@nestjs/common';
import { FiscalConfigModule } from '../fiscal-config/fiscal-config.module';
import { ONLINE_CHECKOUT_PORT, PAYMENT_PORT } from './application/ports/payment.port';
import { PaymentSettingsService } from './application/services/payment-settings.service';
import { RoutingPaymentAdapter } from './infrastructure/adapters/routing-payment.adapter';
import { StubPaymentAdapter } from './infrastructure/adapters/stub-payment.adapter';
import { PaymentProviderConfigStore } from './infrastructure/persistence/payment-provider-config.store';
import { PaymentSettingsController } from './presentation/http/payment-settings.controller';

/**
 * Payment module — the PaymentPort seam (PAYNET-1). PAYMENT_PORT / ONLINE_CHECKOUT_PORT
 * are bound to the RoutingPaymentAdapter: a branch with an active Paynet config uses
 * Paynet's hosted checkout (charge() = verify); others fall back to the stub when
 * PAYMENT_ALLOW_STUB. Call sites are unchanged. FiscalConfigModule provides the
 * envelope crypto (FISCAL_MASTER_KEK) reused for the Paynet secrets.
 */
@Module({
  imports: [FiscalConfigModule],
  controllers: [PaymentSettingsController],
  providers: [
    StubPaymentAdapter,
    PaymentProviderConfigStore,
    RoutingPaymentAdapter,
    PaymentSettingsService,
    { provide: PAYMENT_PORT, useExisting: RoutingPaymentAdapter },
    { provide: ONLINE_CHECKOUT_PORT, useExisting: RoutingPaymentAdapter },
  ],
  exports: [PAYMENT_PORT, ONLINE_CHECKOUT_PORT, PaymentProviderConfigStore],
})
export class PaymentModule {}
