import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EdgeConfigService } from '../../../shared/edge/edge-config.service';
import { EdgeSyncGate } from '../../../shared/edge/edge-sync-gate';
import {
  OutboxAggregateType,
  OutboxOp,
  PushEntry,
} from '../../../shared/edge/contracts/operational.contract';
import { AppConfig } from '../../../shared/infrastructure/config/env.schema';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { EdgeSchemaMismatchError, SnapshotClient } from './snapshot-client';

export interface PushRunResult {
  pushed: number;
  lastPushedSeq: number | null;
  pending: number;
  reason?: string;
}

/** Max entries per push request. */
const BATCH_SIZE = 200;
/** Delay before the first post-boot push (lets bootstrap settle). */
const INITIAL_PUSH_DELAY_MS = 7_000;

/**
 * SyncPushService (EDGE only, OFF-4) — drains the operational outbox to the cloud
 * in edgeSeq order. Pushes PENDING entries in batches; marks acked entries SYNCED
 * (via appliedIds) and advances lastPushedSeq/lastPushAt. NEVER advances past an
 * unacked entry — at-least-once delivery + idempotent cloud apply = effectively
 * once. On failure it stays put and retries next tick.
 */
@Injectable()
export class SyncPushService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SyncPushService.name);
  private readonly intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private initialTimer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly edge: EdgeConfigService,
    private readonly client: SnapshotClient,
    private readonly prisma: PrismaService,
    private readonly gate: EdgeSyncGate,
    config: ConfigService<AppConfig, true>,
  ) {
    this.intervalMs = config.get('EDGE_PUSH_INTERVAL_MS', { infer: true });
  }

  onApplicationBootstrap(): void {
    if (!this.edge.isPaired) {
      return;
    }
    this.initialTimer = setTimeout(() => void this.tick(), INITIAL_PUSH_DELAY_MS);
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

  /** Best-effort background trigger (e.g. after a burst of writes). */
  schedulePush(): void {
    if (this.edge.isPaired) {
      setTimeout(() => void this.tick(), 0);
    }
  }

  private async tick(): Promise<void> {
    if (this.running) {
      return; // avoid overlapping drains
    }
    this.running = true;
    try {
      await this.pushNow();
    } finally {
      this.running = false;
    }
  }

  /**
   * Drain PENDING outbox entries to the cloud. Loops batches until the queue is
   * empty or the cloud stops acking the whole batch.
   */
  async pushNow(): Promise<PushRunResult> {
    if (!this.edge.isPaired) {
      return { pushed: 0, lastPushedSeq: null, pending: 0, reason: 'NOT_EDGE' };
    }
    // Sync is paused for a schema mismatch — keep accruing the outbox locally,
    // do not push (a stale hub must not write a possibly-incompatible payload).
    if (this.gate.isPaused) {
      const pending = await this.prisma.outboxEntry.count({ where: { status: 'PENDING' } });
      return { pushed: 0, lastPushedSeq: null, pending, reason: 'SYNC_PAUSED' };
    }
    if (!this.client.isConfigured()) {
      await this.markOffline();
      const pending = await this.prisma.outboxEntry.count({ where: { status: 'PENDING' } });
      return { pushed: 0, lastPushedSeq: null, pending, reason: 'NOT_CONFIGURED' };
    }

    const { nodeId } = this.edge.getIdentity();
    let pushed = 0;
    let lastPushedSeq: number | null = null;

    try {
      for (;;) {
        const batch = await this.prisma.outboxEntry.findMany({
          where: { status: 'PENDING' },
          orderBy: { edgeSeq: 'asc' },
          take: BATCH_SIZE,
        });
        if (batch.length === 0) {
          break;
        }

        const entries: PushEntry[] = batch.map((e) => ({
          id: e.id,
          edgeSeq: e.edgeSeq,
          aggregateType: e.aggregateType as OutboxAggregateType,
          op: e.op as OutboxOp,
          payload: e.payload,
        }));

        const result = await this.client.pushOperational(entries);

        if (result.appliedIds.length > 0) {
          const now = new Date();
          await this.prisma.outboxEntry.updateMany({
            where: { id: { in: result.appliedIds } },
            data: { status: 'SYNCED', syncedAt: now },
          });
          pushed += result.appliedIds.length;
          if (result.lastAppliedSeq !== null) {
            lastPushedSeq = result.lastAppliedSeq;
          }
          await this.prisma.edgeSyncState.updateMany({
            where: { nodeId },
            data: {
              lastPushedSeq: result.lastAppliedSeq ?? undefined,
              lastPushAt: now,
              online: true,
            },
          });
        }

        // Stop if the cloud did not ack the entire batch (resume next tick) or
        // this was the last (smaller-than-full) batch.
        if (result.appliedIds.length < batch.length || batch.length < BATCH_SIZE) {
          break;
        }
      }

      const pending = await this.prisma.outboxEntry.count({ where: { status: 'PENDING' } });
      return { pushed, lastPushedSeq, pending };
    } catch (err) {
      // A schema mismatch pauses sync (not a connectivity failure). The entries
      // already acked this run stay SYNCED; the rest wait for the version match.
      if (err instanceof EdgeSchemaMismatchError) {
        this.gate.pauseForSchemaMismatch(err.expectedSchemaVersion);
        const pending = await this.prisma.outboxEntry.count({ where: { status: 'PENDING' } });
        return { pushed, lastPushedSeq, pending, reason: 'SCHEMA_MISMATCH' };
      }
      await this.markOffline();
      this.logger.warn(`Operational push failed (will retry): ${(err as Error).message}`);
      const pending = await this.prisma.outboxEntry.count({ where: { status: 'PENDING' } });
      return { pushed, lastPushedSeq, pending, reason: (err as Error).message };
    }
  }

  private async markOffline(): Promise<void> {
    const { nodeId } = this.edge.getIdentity();
    await this.prisma.edgeSyncState.updateMany({ where: { nodeId }, data: { online: false } });
  }
}
