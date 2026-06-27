import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { AppConfig } from '../infrastructure/config/env.schema';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { EdgeConfigService } from './edge-config.service';
import { EdgeSyncGate } from './edge-sync-gate';
import { APP_VERSION, SCHEMA_VERSION } from './version';

/** Shape returned by GET /edge/info. */
export interface EdgeInfo {
  mode: 'CLOUD' | 'EDGE';
  organizationId: string | null;
  restaurantId: string | null;
  branchId: string | null;
  nodeId: string | null;
  appVersion: string;
  /** The edge schema version THIS process runs (override-aware on edge). */
  schemaVersion: string;
  /** The schema version expected for sync (cloud-reported, else the built-in). */
  expectedSchemaVersion: string;
  db: 'ok' | 'down';
  /** Config-sync connectivity (OFF-3). Null in CLOUD / before first sync. */
  online: boolean | null;
  /** When config last synced from the cloud (OFF-3). Null until first sync. */
  lastConfigSyncedAt: string | null;
  /** Operational outbox pending count (OFF-4). Null in CLOUD. */
  pendingOutbox: number | null;
  /** Highest outbox edgeSeq acked by the cloud (OFF-4). Null in CLOUD / none. */
  lastPushedSeq: number | null;
  /** When the outbox last pushed to the cloud (OFF-4). Null until first push. */
  lastPushAt: string | null;
  /** When the hub last heartbeated to the cloud (OFF-8). Null in CLOUD / never. */
  lastHeartbeatAt: string | null;
  /** Whether sync is paused for a schema mismatch (OFF-8). False in CLOUD. */
  syncPaused: boolean;
  /** Whether an operator must update this hub before sync resumes (OFF-8). */
  updateRequired: boolean;
  serverTime: string;
}

/**
 * Edge identity / health endpoint. PUBLIC (no auth): it exposes only the ids a
 * LAN client (OFF-6) needs to confirm it is paired to the right hub, plus a DB
 * liveness check and sync/version telemetry for monitoring (OFF-8). In CLOUD mode
 * it still answers, with mode "CLOUD", null edge ids, and inert sync fields.
 */
@ApiTags('edge')
@Public()
@Controller('edge')
export class EdgeController {
  /** The schema version THIS process reports (edge override-aware). */
  private readonly reportedSchemaVersion: string;

  constructor(
    private readonly edge: EdgeConfigService,
    private readonly prisma: PrismaService,
    private readonly gate: EdgeSyncGate,
    config: ConfigService<AppConfig, true>,
  ) {
    this.reportedSchemaVersion =
      config.get('EDGE_SCHEMA_VERSION', { infer: true }) ?? SCHEMA_VERSION;
  }

  @Get('info')
  @ApiOkResponse({
    description: 'Edge hub identity + liveness + sync/version telemetry.',
    schema: {
      example: {
        mode: 'EDGE',
        organizationId: 'org_123',
        restaurantId: 'rst_123',
        branchId: 'brn_123',
        nodeId: 'node-kitchen-01',
        appVersion: '0.1.0',
        schemaVersion: '2',
        expectedSchemaVersion: '2',
        db: 'ok',
        online: true,
        lastConfigSyncedAt: '2026-06-27T00:00:00.000Z',
        pendingOutbox: 0,
        lastPushedSeq: 42,
        lastPushAt: '2026-06-27T00:00:00.000Z',
        lastHeartbeatAt: '2026-06-27T00:00:00.000Z',
        syncPaused: false,
        updateRequired: false,
        serverTime: '2026-06-27T00:00:00.000Z',
      },
    },
  })
  async info(): Promise<EdgeInfo> {
    let db: 'ok' | 'down' = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }

    const identity = this.edge.getIdentityOrNull();

    // OFF-3/OFF-4 sync state, read from the edge-local bookkeeping (EDGE only).
    let online: boolean | null = null;
    let lastConfigSyncedAt: string | null = null;
    let pendingOutbox: number | null = null;
    let lastPushedSeq: number | null = null;
    let lastPushAt: string | null = null;
    if (identity && db === 'ok') {
      try {
        const [state, pending] = await Promise.all([
          this.prisma.edgeSyncState.findUnique({
            where: { nodeId: identity.nodeId },
            select: {
              online: true,
              lastConfigSyncedAt: true,
              lastPushedSeq: true,
              lastPushAt: true,
            },
          }),
          this.prisma.outboxEntry.count({ where: { status: 'PENDING' } }),
        ]);
        pendingOutbox = pending;
        if (state) {
          online = state.online;
          lastConfigSyncedAt = state.lastConfigSyncedAt?.toISOString() ?? null;
          lastPushedSeq = state.lastPushedSeq;
          lastPushAt = state.lastPushAt?.toISOString() ?? null;
        }
      } catch {
        // leave nulls
      }
    }

    return {
      mode: this.edge.mode,
      organizationId: identity?.organizationId ?? null,
      restaurantId: identity?.restaurantId ?? null,
      branchId: identity?.branchId ?? null,
      nodeId: identity?.nodeId ?? null,
      appVersion: APP_VERSION,
      schemaVersion: this.reportedSchemaVersion,
      expectedSchemaVersion: this.gate.expected ?? SCHEMA_VERSION,
      db,
      online,
      lastConfigSyncedAt,
      pendingOutbox,
      lastPushedSeq,
      lastPushAt,
      lastHeartbeatAt: this.gate.lastHeartbeat?.toISOString() ?? null,
      syncPaused: this.gate.isPaused,
      updateRequired: this.gate.isUpdateRequired,
      serverTime: new Date().toISOString(),
    };
  }
}
