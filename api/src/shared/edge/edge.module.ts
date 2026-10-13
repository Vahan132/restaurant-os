import { Global, Module } from '@nestjs/common';
import { EdgeConfigService } from './edge-config.service';
import { EdgeController } from './edge.controller';
import { EdgeSyncGate } from './edge-sync-gate';
import { HubDeviceProvisioner } from './hub-device-provisioner';
import { OUTBOX_RECORDER, PrismaOutboxRecorder } from './outbox-recorder';

/**
 * EdgeModule — GLOBAL, always imported by AppModule (both modes). It exposes the
 * runtime mode + edge identity (EdgeConfigService) to guards and the gateway,
 * serves the public GET /edge/info endpoint, provides the OUTBOX_RECORDER
 * (OFF-4) that operational repos call inside their write transactions, and the
 * EdgeSyncGate (OFF-8) that pauses sync on a schema mismatch. Inert in CLOUD.
 *
 * PrismaService (for the /edge/info DB probe) comes from the global PrismaModule;
 * ConfigService from the global config module.
 */
@Global()
@Module({
  controllers: [EdgeController],
  providers: [
    EdgeConfigService,
    EdgeSyncGate,
    HubDeviceProvisioner,
    { provide: OUTBOX_RECORDER, useClass: PrismaOutboxRecorder },
  ],
  exports: [EdgeConfigService, EdgeSyncGate, OUTBOX_RECORDER],
})
export class EdgeModule {}
