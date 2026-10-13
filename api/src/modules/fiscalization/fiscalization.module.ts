import { Module } from '@nestjs/common';
import { EdgeConfigService } from '../../shared/edge/edge-config.service';
import { FiscalConfigModule } from '../fiscal-config/fiscal-config.module';
import { EHDM_TRANSPORT } from './application/ports/ehdm-transport.port';
import { FISCALIZATION_PORT, FiscalizationPort } from './application/ports/fiscalization.port';
import { ChannelRouterFiscalizationAdapter } from './infrastructure/adapters/channel-router-fiscalization.adapter';
import { EHdmFiscalizationAdapter } from './infrastructure/adapters/ehdm-fiscalization.adapter';
import { PhysicalHdmFiscalizationAdapter } from './infrastructure/adapters/physical-hdm-fiscalization.adapter';
import { StubFiscalizationAdapter } from './infrastructure/adapters/stub-fiscalization.adapter';
import { HttpsEHdmTransport } from './infrastructure/http/https-ehdm.transport';

/**
 * Fiscalization module. FISCALIZATION_PORT is selected by APP_MODE (FISCAL-EDGE-2):
 *   - EDGE (hub)  → PhysicalHdmFiscalizationAdapter (TCP/3DES to the LAN HDM). The
 *                   channel-switch router is RETIRED here — selection is by WHERE
 *                   the process runs, not order.channel.
 *   - CLOUD       → ChannelRouterFiscalizationAdapter (QR_WEB/APP → e-HDM, POS → stub).
 * All adapters read per-tenant config via FISCAL_CONFIG_PORT (FiscalConfigModule;
 * DB-backed encrypted store on the hub, env/file on cloud dev). Exports the e-HDM
 * adapter so the platform-admin fiscal-config surface can drive checkConnection.
 */
@Module({
  imports: [FiscalConfigModule],
  providers: [
    StubFiscalizationAdapter,
    EHdmFiscalizationAdapter,
    ChannelRouterFiscalizationAdapter,
    PhysicalHdmFiscalizationAdapter,
    { provide: EHDM_TRANSPORT, useClass: HttpsEHdmTransport },
    {
      provide: FISCALIZATION_PORT,
      useFactory: (
        edge: EdgeConfigService,
        physical: PhysicalHdmFiscalizationAdapter,
        router: ChannelRouterFiscalizationAdapter,
      ): FiscalizationPort => (edge.isEdge ? physical : router),
      inject: [EdgeConfigService, PhysicalHdmFiscalizationAdapter, ChannelRouterFiscalizationAdapter],
    },
  ],
  exports: [FISCALIZATION_PORT, EHdmFiscalizationAdapter],
})
export class FiscalizationModule {}
