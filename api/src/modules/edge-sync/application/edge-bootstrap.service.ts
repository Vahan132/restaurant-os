import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { EdgeConfigService } from '../../../shared/edge/edge-config.service';
import { OUTBOX_COUNTER_ID } from '../../../shared/edge/outbox-recorder';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { SnapshotApplier } from './snapshot-applier';
import { SnapshotClient } from './snapshot-client';

export interface SyncResult {
  applied: boolean;
  snapshotVersion: string | null;
  reason?: string;
}

/**
 * EdgeBootstrapService — on boot (EDGE only), if the local DB is UNSEEDED (no
 * EdgeSyncState row for this node), pull the cloud snapshot and apply it. This
 * replaces the temporary OFF-1 seed. Also backs the manual POST /edge/resync.
 *
 * Bootstrap failures are NON-FATAL: the hub still boots (it may already hold a
 * prior snapshot, or be intentionally offline) and can resync later.
 */
@Injectable()
export class EdgeBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EdgeBootstrapService.name);

  constructor(
    private readonly edge: EdgeConfigService,
    private readonly client: SnapshotClient,
    private readonly applier: SnapshotApplier,
    private readonly prisma: PrismaService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.edge.isEdge) {
      return;
    }
    const { nodeId } = this.edge.getIdentity();
    const existing = await this.prisma.edgeSyncState.findUnique({ where: { nodeId } });
    if (existing) {
      this.logger.log(
        `Edge already bootstrapped (snapshotVersion=${existing.snapshotVersion ?? 'n/a'}); skipping pull.`,
      );
      return;
    }
    if (!this.client.isConfigured()) {
      this.logger.warn(
        'Edge is unseeded but CLOUD_URL/EDGE_NODE_TOKEN are not set — skipping bootstrap. ' +
          'Set them and call POST /edge/resync to pull the branch snapshot.',
      );
      return;
    }
    try {
      const result = await this.sync();
      this.logger.log(`Edge bootstrap complete (snapshotVersion=${result.snapshotVersion}).`);
    } catch (err) {
      this.logger.error(`Edge bootstrap failed (non-fatal): ${(err as Error).message}`);
    }
  }

  /**
   * Pull + apply the snapshot, then record EdgeSyncState. Idempotent — safe to
   * run repeatedly (upserts by id; re-pull overwrites with newer cloud state).
   */
  async sync(): Promise<SyncResult> {
    const { nodeId } = this.edge.getIdentity();
    const snapshot = await this.client.fetchSnapshot();
    await this.applier.apply(snapshot);
    // Ensure the gapless outbox counter exists so OFF-4 writes hit the atomic
    // increment path (idempotent — never rewinds an existing sequence).
    await this.prisma.edgeOutboxCounter.upsert({
      where: { id: OUTBOX_COUNTER_ID },
      create: { id: OUTBOX_COUNTER_ID, seq: 0 },
      update: {},
    });
    const now = new Date();
    // OFF-3: seed the config cursor (ISO) at the snapshot build time minus an
    // overlap, so the first config-sync re-includes anything changed right around
    // the snapshot (idempotent). Set ONLY on first create — a resync must NOT
    // rewind a cursor the edge has already advanced.
    const initialCursor = this.initialConfigCursor(snapshot.meta.snapshotVersion);
    await this.prisma.edgeSyncState.upsert({
      where: { nodeId },
      update: { snapshotVersion: snapshot.meta.snapshotVersion, lastSyncedAt: now },
      create: {
        nodeId,
        snapshotVersion: snapshot.meta.snapshotVersion,
        lastSyncedAt: now,
        lastConfigCursor: initialCursor,
      },
    });
    return { applied: true, snapshotVersion: snapshot.meta.snapshotVersion };
  }

  /**
   * The config cursor to seed at first bootstrap: the snapshot build time (ms
   * epoch) pulled back 60s as an ISO string. Falls back to "now − 60s" if the
   * snapshot version isn't a numeric timestamp.
   */
  private initialConfigCursor(snapshotVersion: string): string {
    const OVERLAP_MS = 60_000;
    const ms = Number(snapshotVersion);
    const base = Number.isFinite(ms) ? ms : Date.now();
    return new Date(base - OVERLAP_MS).toISOString();
  }
}
