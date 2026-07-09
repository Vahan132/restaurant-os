import { Module } from '@nestjs/common';
import { EHDM_TRANSPORT } from './application/ports/ehdm-transport.port';
import { FISCAL_CONFIG_PORT } from './application/ports/fiscal-config.port';
import { FISCALIZATION_PORT } from './application/ports/fiscalization.port';
import { ChannelRouterFiscalizationAdapter } from './infrastructure/adapters/channel-router-fiscalization.adapter';
import { EHdmFiscalizationAdapter } from './infrastructure/adapters/ehdm-fiscalization.adapter';
import { StubFiscalizationAdapter } from './infrastructure/adapters/stub-fiscalization.adapter';
import { EnvFileFiscalConfigAdapter } from './infrastructure/config/env-file-fiscal-config.adapter';
import { HttpsEHdmTransport } from './infrastructure/http/https-ehdm.transport';

/**
 * Fiscalization module. FISCALIZATION_PORT resolves to the CHANNEL ROUTER
 * (FISCAL-1, decision B): QR_WEB/APP → electronic-HDM adapter, POS → stub (until
 * the physical adapter lands in FISCAL-2). Call sites depend only on the token +
 * the port, so this wiring is the only place that changes as real adapters land.
 * The e-HDM adapter reads per-tenant config via FISCAL_CONFIG_PORT (env/file for
 * now) and speaks mutual TLS via EHDM_TRANSPORT (node:https). ConfigService is
 * provided globally by AppConfigModule.
 */
@Module({
  providers: [
    StubFiscalizationAdapter,
    EHdmFiscalizationAdapter,
    ChannelRouterFiscalizationAdapter,
    { provide: FISCAL_CONFIG_PORT, useClass: EnvFileFiscalConfigAdapter },
    { provide: EHDM_TRANSPORT, useClass: HttpsEHdmTransport },
    { provide: FISCALIZATION_PORT, useClass: ChannelRouterFiscalizationAdapter },
  ],
  exports: [FISCALIZATION_PORT],
})
export class FiscalizationModule {}
