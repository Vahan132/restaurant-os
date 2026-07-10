import { Module } from '@nestjs/common';
import { FiscalConfigModule } from '../fiscal-config/fiscal-config.module';
import { EHDM_TRANSPORT } from './application/ports/ehdm-transport.port';
import { FISCALIZATION_PORT } from './application/ports/fiscalization.port';
import { ChannelRouterFiscalizationAdapter } from './infrastructure/adapters/channel-router-fiscalization.adapter';
import { EHdmFiscalizationAdapter } from './infrastructure/adapters/ehdm-fiscalization.adapter';
import { StubFiscalizationAdapter } from './infrastructure/adapters/stub-fiscalization.adapter';
import { HttpsEHdmTransport } from './infrastructure/http/https-ehdm.transport';

/**
 * Fiscalization module. FISCALIZATION_PORT resolves to the channel router
 * (QR_WEB/APP → e-HDM, POS → stub). The e-HDM adapter reads per-tenant config via
 * FISCAL_CONFIG_PORT, now provided by FiscalConfigModule (DB-backed encrypted store
 * for cloud, env/file for edge — selected by FISCAL_CONFIG_BACKEND). Exports the
 * e-HDM adapter so the platform-admin fiscal-config surface can drive checkConnection.
 */
@Module({
  imports: [FiscalConfigModule],
  providers: [
    StubFiscalizationAdapter,
    EHdmFiscalizationAdapter,
    ChannelRouterFiscalizationAdapter,
    { provide: EHDM_TRANSPORT, useClass: HttpsEHdmTransport },
    { provide: FISCALIZATION_PORT, useClass: ChannelRouterFiscalizationAdapter },
  ],
  exports: [FISCALIZATION_PORT, EHdmFiscalizationAdapter],
})
export class FiscalizationModule {}
