import { Module } from '@nestjs/common';
import { FISCALIZATION_PORT } from './application/ports/fiscalization.port';
import { StubFiscalizationAdapter } from './infrastructure/adapters/stub-fiscalization.adapter';

/**
 * Fiscalization module — defines the FiscalizationPort seam and binds the no-op
 * StubFiscalizationAdapter by default. Exports the token so later payment/receipt
 * use-cases can inject it; real adapters replace the binding here without any
 * call-site change.
 */
@Module({
  providers: [{ provide: FISCALIZATION_PORT, useClass: StubFiscalizationAdapter }],
  exports: [FISCALIZATION_PORT],
})
export class FiscalizationModule {}
