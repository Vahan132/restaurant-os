import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OutboxRecord } from './contracts/operational.contract';
import { EdgeConfigService } from './edge-config.service';

export const OUTBOX_RECORDER = Symbol('OutboxRecorder');

/** Singleton id for the gapless edge sequence counter. */
export const OUTBOX_COUNTER_ID = 'edge';

/**
 * OutboxRecorder — appends operational outbox entries (OFF-4). Operational repos
 * call `record(tx, records)` INSIDE their existing transaction, right after the
 * write, so the capture is atomic with the write (a change can never be missed).
 * The recorder re-reads each aggregate's full current state within the same tx,
 * assigns a gapless per-node edgeSeq, and inserts the entries.
 *
 * Inert in CLOUD mode (no-op) — the outbox only exists on edge nodes.
 */
export interface OutboxRecorder {
  record(tx: Prisma.TransactionClient, records: OutboxRecord[]): Promise<void>;
}

/** Serialize a Prisma row to a JSON-safe value (Date→ISO, bigint→string). */
function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
  ) as Prisma.InputJsonValue;
}

@Injectable()
export class PrismaOutboxRecorder implements OutboxRecorder {
  constructor(private readonly edge: EdgeConfigService) {}

  async record(tx: Prisma.TransactionClient, records: OutboxRecord[]): Promise<void> {
    if (!this.edge.isEdge || records.length === 0) {
      return; // no-op in CLOUD
    }

    // Re-read each aggregate's full current state within this transaction.
    const built: Array<{ record: OutboxRecord; payload: Prisma.InputJsonValue }> = [];
    for (const record of records) {
      const payload = await this.loadPayload(tx, record);
      if (payload !== null) {
        built.push({ record, payload });
      }
    }
    if (built.length === 0) {
      return;
    }

    // Assign a GAPLESS, contiguous block of edgeSeq values. The atomic increment
    // holds a row lock on the singleton counter, so concurrent transactions get
    // disjoint blocks in lock-acquisition (≈ commit) order.
    const n = built.length;
    const counter = await tx.edgeOutboxCounter.upsert({
      where: { id: OUTBOX_COUNTER_ID },
      create: { id: OUTBOX_COUNTER_ID, seq: n },
      update: { seq: { increment: n } },
    });
    let seq = counter.seq - n;
    for (const b of built) {
      seq += 1;
      await tx.outboxEntry.create({
        data: {
          aggregateType: b.record.aggregateType,
          aggregateId: b.record.aggregateId,
          op: b.record.op,
          payload: b.payload,
          edgeSeq: seq,
        },
      });
    }
  }

  /** Load the full current state of an aggregate by id, JSON-serialized. */
  private async loadPayload(
    tx: Prisma.TransactionClient,
    record: OutboxRecord,
  ): Promise<Prisma.InputJsonValue | null> {
    const { aggregateType: type, aggregateId: id } = record;
    switch (type) {
      case 'ORDER': {
        const row = await tx.order.findUnique({
          where: { id },
          include: { items: { include: { modifiers: true } }, payments: true },
        });
        return row ? toJson(row) : null;
      }
      case 'RESERVATION': {
        const row = await tx.reservation.findUnique({ where: { id } });
        return row ? toJson(row) : null;
      }
      case 'STOCK_LAYER': {
        const row = await tx.stockLayer.findUnique({ where: { id } });
        return row ? toJson(row) : null;
      }
      case 'STOCK_MOVEMENT': {
        const row = await tx.stockMovement.findUnique({ where: { id } });
        return row ? toJson(row) : null;
      }
      case 'GOODS_RECEIPT': {
        const row = await tx.goodsReceipt.findUnique({ where: { id }, include: { lines: true } });
        return row ? toJson(row) : null;
      }
      case 'WRITE_OFF': {
        const row = await tx.writeOff.findUnique({ where: { id }, include: { lines: true } });
        return row ? toJson(row) : null;
      }
      case 'PROCESS_RUN': {
        const row = await tx.processRun.findUnique({ where: { id } });
        return row ? toJson(row) : null;
      }
      default: {
        // Exhaustiveness guard — a new aggregate type must add a loader above.
        const _exhaustive: never = type;
        return _exhaustive;
      }
    }
  }
}
