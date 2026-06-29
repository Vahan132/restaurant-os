import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EdgeConfigService } from '../../../shared/edge/edge-config.service';
import { EdgeSyncGate } from '../../../shared/edge/edge-sync-gate';
import { APP_VERSION } from '../../../shared/edge/version';
import { AppConfig } from '../../../shared/infrastructure/config/env.schema';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { EdgeSchemaMismatchError, SnapshotClient } from './snapshot-client';

export interface HeartbeatRunResult {
  sent: boolean;
  schemaMatch?: boolean;
  paused?: boolean;
  reason?: string;
}

/** Delay before the first post-boot heartbeat (lets bootstrap settle). */
const INITIAL_HEARTBEAT_DELAY_MS = 8_000;

/**
 * HeartbeatService (EDGE only, OFF-8) — POSTs a heartbeat to the cloud every
 * EDGE_HEARTBEAT_INTERVAL_MS (30–60s) reporting telemetry + this hub's app/schema
 * versions. The reply tells the hub whether its schema is compatible: it drives
 * the EdgeSyncGate (pause on mismatch, resume on match) so a stale hub keeps
 * serving locally but stops syncing until updated. A heartbeat success also marks
 * the hub online; a network failure marks it offline (but does NOT touch the
 * gate — offline ≠ schema-incompatible).
 */
@Injectable()
export class HeartbeatService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(HeartbeatService.name);
  private readonly intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private initialTimer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly edge: EdgeConfigService,
    private readonly client: SnapshotClient,
    private readonly gate: EdgeSyncGate,
    private readonly prisma: PrismaService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.intervalMs = config.get('EDGE_HEARTBEAT_INTERVAL_MS', { infer: true });
  }

  onApplicationBootstrap(): void {
    if (!this.edge.isEdge) {
      return;
    }
    this.initialTimer = setTimeout(() => void this.tick(), INITIAL_HEARTBEAT_DELAY_MS);
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

  private async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.sendHeartbeat();
    } finally {
      this.running = false;
    }
  }

  /** Build telemetry, send one heartbeat, and reconcile the gate + online flag. */
  async sendHeartbeat(): Promise<HeartbeatRunResult> {
    if (!this.edge.isEdge) {
      return { sent: false, reason: 'NOT_EDGE' };
    }
    if (!this.client.isConfigured()) {
      await this.markOffline();
      return { sent: false, reason: 'NOT_CONFIGURED' };
    }

    const { nodeId } = this.edge.getIdentity();
    const [state, pendingOutboxCount, dbStatus] = await Promise.all([
      this.prisma.edgeSyncState.findUnique({ where: { nodeId } }),
      this.prisma.outboxEntry.count({ where: { status: 'PENDING' } }),
      this.probeDb(),
    ]);

    try {
      const result = await this.client.sendHeartbeat({
        lastConfigSyncedAt: state?.lastConfigSyncedAt?.toISOString() ?? null,
        lastPushedSeq: state?.lastPushedSeq ?? null,
        pendingOutboxCount,
        appVersion: APP_VERSION,
        schemaVersion: this.client.schemaVersion(),
        dbStatus,
        uptimeSeconds: Math.floor(process.uptime()),
      });

      // Drive the sync gate from the authoritative cloud verdict.
      this.gate.markHeartbeat();
      if (result.schemaMatch) {
        this.gate.resume();
      } else {
        this.gate.pauseForSchemaMismatch(result.expectedSchemaVersion);
      }

      await this.prisma.edgeSyncState.updateMany({ where: { nodeId }, data: { online: true } });
      return { sent: true, schemaMatch: result.schemaMatch, paused: this.gate.isPaused };
    } catch (err) {
      // The heartbeat endpoint is not schema-guarded, but be defensive.
      if (err instanceof EdgeSchemaMismatchError) {
        this.gate.pauseForSchemaMismatch(err.expectedSchemaVersion);
        return { sent: false, paused: true, reason: 'SCHEMA_MISMATCH' };
      }
      await this.markOffline();
      this.logger.warn(
        `Heartbeat failed (hub will read OFFLINE in cloud): ${(err as Error).message}`,
      );
      return { sent: false, reason: (err as Error).message };
    }
  }

  private async probeDb(): Promise<string> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'down';
    }
  }

  private async markOffline(): Promise<void> {
    const { nodeId } = this.edge.getIdentity();
    await this.prisma.edgeSyncState.updateMany({ where: { nodeId }, data: { online: false } });
  }
}
