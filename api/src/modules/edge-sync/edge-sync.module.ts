import { Module } from '@nestjs/common';
import { ConfigSyncService } from './application/config-sync.service';
import { EdgeBootstrapService } from './application/edge-bootstrap.service';
import { HeartbeatService } from './application/heartbeat.service';
import { SnapshotApplier } from './application/snapshot-applier';
import { SnapshotClient } from './application/snapshot-client';
import { SyncPushService } from './application/sync-push.service';
import { EdgeSyncController } from './presentation/http/edge-sync.controller';

/**
 * Edge sync (EDGE-only, OFF-2). On boot it pulls + applies the branch snapshot
 * when the local DB is unseeded (replacing the OFF-1 seed), and exposes
 * POST /edge/resync for an on-demand re-pull. Excluded from CLOUD composition.
 *
 * EdgeConfigService (edge identity) and PrismaService come from global modules.
 */
@Module({
  controllers: [EdgeSyncController],
  providers: [
    SnapshotClient,
    SnapshotApplier,
    EdgeBootstrapService,
    ConfigSyncService,
    SyncPushService,
    HeartbeatService,
  ],
})
export class EdgeSyncModule {}
