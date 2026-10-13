import { Module } from '@nestjs/common';
import { CloudPairClient } from './application/cloud-pair.client';
import { ConfigSyncService } from './application/config-sync.service';
import { EdgeBootstrapService } from './application/edge-bootstrap.service';
import { EdgeIdentityStore } from './application/edge-identity.store';
import { HeartbeatService } from './application/heartbeat.service';
import { HUB_RESTART, ProcessExitHubRestart } from './application/hub-restart.port';
import { PairHubUseCase } from './application/pair-hub.usecase';
import { SnapshotApplier } from './application/snapshot-applier';
import { SnapshotClient } from './application/snapshot-client';
import { SyncPushService } from './application/sync-push.service';
import { EdgeSyncController } from './presentation/http/edge-sync.controller';
import { SetupController } from './presentation/http/setup.controller';
import { SetupPageController } from './presentation/http/setup-page.controller';

/**
 * Edge sync (EDGE-only, OFF-2). On boot it pulls + applies the branch snapshot
 * when the local DB is unseeded (replacing the OFF-1 seed), and exposes
 * POST /edge/resync for an on-demand re-pull. Excluded from CLOUD composition.
 *
 * EdgeConfigService (edge identity) and PrismaService come from global modules.
 */
@Module({
  controllers: [EdgeSyncController, SetupController, SetupPageController],
  providers: [
    SnapshotClient,
    SnapshotApplier,
    EdgeBootstrapService,
    ConfigSyncService,
    SyncPushService,
    HeartbeatService,
    // EDGE-SETUP-3A: hub-local pairing + identity persistence.
    CloudPairClient,
    EdgeIdentityStore,
    PairHubUseCase,
    { provide: HUB_RESTART, useClass: ProcessExitHubRestart },
  ],
})
export class EdgeSyncModule {}
