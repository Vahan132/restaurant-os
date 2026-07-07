import { Module } from '@nestjs/common';
import { PAYMENT_PORT } from './application/ports/payment.port';
import { StubPaymentAdapter } from './infrastructure/adapters/stub-payment.adapter';

/**
 * Payment module — defines the PaymentPort seam and binds the no-op
 * StubPaymentAdapter by default. Exports the token so the ordering use-cases can
 * inject it; a real card gateway replaces the binding here without any call-site
 * change (mirrors FiscalizationModule).
 */
@Module({
  providers: [{ provide: PAYMENT_PORT, useClass: StubPaymentAdapter }],
  exports: [PAYMENT_PORT],
})
export class PaymentModule {}
