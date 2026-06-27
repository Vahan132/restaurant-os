import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EdgeConfigService } from '../../../shared/edge/edge-config.service';
import { EdgeSyncGate } from '../../../shared/edge/edge-sync-gate';
import { AppConfig } from '../../../shared/infrastructure/config/env.schema';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { SnapshotApplier } from './snapshot-applier';
import { EdgeSchemaMismatchError, SnapshotClient } from './snapshot-client';

export interface ConfigSyncResult {
  synced: boolean;
  cursor?: string;
  reason?: string;
}

/** Delay before the first post-boot sync, letting OFF-2 bootstrap finish. */
const INITIAL_SYNC_DELAY_MS = 5_000;

/**
 * ConfigSyncService (EDGE only, OFF-3) — periodically pulls cloud→edge CONFIG
 * changes and applies them, and exposes a manual trigger. The sync attempt
 * itself is the connectivity probe: success ⇒ online, failure ⇒ offline (keep
 * the last-synced config, retry next tick). Config is READ-ONLY on the edge;
 * this never writes config from local sources.
 */
@Injectable()
export class ConfigSyncService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ConfigSyncService.name);
  private readonly intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private initialTimer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly edge: EdgeConfigService,
    private readonly client: SnapshotClient,
    private readonly applier: SnapshotApplier,
    private readonly prisma: PrismaService,
    private readonly gate: EdgeSyncGate,
    config: ConfigService<AppConfig, true>,
  ) {
    this.intervalMs = config.get('CONFIG_SYNC_INTERVAL_MS', { infer: true });
  }

  onApplicationBootstrap(): void {
    if (!this.edge.isEdge) {
      return;
    }
    // Initial catch-up shortly after boot (once the snapshot bootstrap has run),
    // then poll on the configured interval.
    this.initialTimer = setTimeout(() => void this.tick(), INITIAL_SYNC_DELAY_MS);
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    if (this.initialTimer) {
      clearTimeout(this.initialTimer);
    }
  }

  /** Interval tick — never throws (errors are logged + recorded as offline). */
  private async tick(): Promise<void> {
    if (this.running) {
      return; // avoid overlapping runs on a slow link
    }
    this.running = true;
    try {
      await this.syncConfig();
    } finally {
      this.running = false;
    }
  }

  /**
   * Pull config changes since the local cursor and apply them. Advances the
   * cursor + marks online on success; marks offline on failure (cursor unchanged).
   */
  async syncConfig(): Promise<ConfigSyncResult> {
    if (!this.edge.isEdge) {
      return { synced: false, reason: 'NOT_EDGE' };
    }
    // Sync is paused for a schema mismatch — keep serving locally, do not pull.
    if (this.gate.isPaused) {
      return { synced: false, reason: 'SYNC_PAUSED' };
    }
    if (!this.client.isConfigured()) {
      await this.markOffline();
      return { synced: false, reason: 'NOT_CONFIGURED' };
    }
    const { nodeId, branchId } = this.edge.getIdentity();
    const state = await this.prisma.edgeSyncState.findUnique({ where: { nodeId } });
    if (!state) {
      // OFF-2 bootstrap has not seeded the local DB yet; nothing to sync onto.
      return { synced: false, reason: 'UNSEEDED' };
    }
    try {
      const changes = await this.client.fetchConfigSync(state.lastConfigCursor ?? null);
      await this.applier.applyConfig(changes, branchId);
      await this.prisma.edgeSyncState.update({
        where: { nodeId },
        data: {
          lastConfigCursor: changes.cursor,
          lastConfigSyncedAt: new Date(),
          online: true,
        },
      });
      return { synced: true, cursor: changes.cursor };
    } catch (err) {
      // A schema mismatch is NOT a connectivity problem — pause sync (the hub
      // keeps serving locally) and leave the online flag alone.
      if (err instanceof EdgeSchemaMismatchError) {
        this.gate.pauseForSchemaMismatch(err.expectedSchemaVersion);
        return { synced: false, reason: 'SCHEMA_MISMATCH' };
      }
      await this.markOffline();
      this.logger.warn(`Config sync failed (staying on last-synced config): ${(err as Error).message}`);
      return { synced: false, reason: (err as Error).message };
    }
  }

  private async markOffline(): Promise<void> {
    const { nodeId } = this.edge.getIdentity();
    // updateMany so it is a no-op (not an error) if the row does not exist yet.
    await this.prisma.edgeSyncState.updateMany({ where: { nodeId }, data: { online: false } });
  }
}
