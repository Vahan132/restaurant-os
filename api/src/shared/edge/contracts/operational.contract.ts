import type {
  GoodsReceipt,
  GoodsReceiptLine,
  Order,
  OrderItem,
  OrderItemModifier,
  Payment,
  ProcessRun,
  Reservation,
  StockLayer,
  StockMovement,
  WriteOff,
  WriteOffLine,
} from '@prisma/client';
import { Jsonify } from './snapshot.contract';

/**
 * Operational sync (OFF-4, edge→cloud). The outbox captures operational + stock
 * writes (never config). Each entry carries the aggregate's full current state
 * with cloud-mirrored ids; the cloud upserts by id, idempotently.
 */
export const OUTBOX_AGGREGATE_TYPES = [
  'ORDER',
  'RESERVATION',
  'STOCK_LAYER',
  'STOCK_MOVEMENT',
  'GOODS_RECEIPT',
  'WRITE_OFF',
  'PROCESS_RUN',
] as const;

export type OutboxAggregateType = (typeof OUTBOX_AGGREGATE_TYPES)[number];

export type OutboxOp = 'CREATE' | 'UPSERT';

/** What a repo asks the recorder to capture (the recorder re-reads full state). */
export interface OutboxRecord {
  aggregateType: OutboxAggregateType;
  aggregateId: string;
  op: OutboxOp;
}

// ── Payload shapes (full aggregate state, as stored in the outbox + pushed) ───
export type OrderPayload = Jsonify<Order> & {
  items: Array<Jsonify<OrderItem> & { modifiers: Jsonify<OrderItemModifier>[] }>;
  payments: Jsonify<Payment>[];
};
export type ReservationPayload = Jsonify<Reservation>;
export type StockLayerPayload = Jsonify<StockLayer>;
export type StockMovementPayload = Jsonify<StockMovement>;
export type GoodsReceiptPayload = Jsonify<GoodsReceipt> & { lines: Jsonify<GoodsReceiptLine>[] };
export type WriteOffPayload = Jsonify<WriteOff> & { lines: Jsonify<WriteOffLine>[] };
export type ProcessRunPayload = Jsonify<ProcessRun>;

/** A single entry on the wire (POST /edge-sync/push). */
export interface PushEntry {
  /** The OutboxEntry id (returned in appliedIds so the edge can mark it SYNCED). */
  id: string;
  edgeSeq: number;
  aggregateType: OutboxAggregateType;
  op: OutboxOp;
  payload: unknown;
}

export interface PushRequest {
  entries: PushEntry[];
}

export interface PushResult {
  /** OutboxEntry ids the cloud applied (or already had) — safe to mark SYNCED. */
  appliedIds: string[];
  /** Highest edgeSeq applied in this batch, or null if none. */
  lastAppliedSeq: number | null;
}
