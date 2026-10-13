import type {
  AuditLog,
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
  // 3B: device-anchored PIN auth-state (per-user lockout counters) produced by
  // offline PIN verification at the edge. Carries COUNTERS ONLY — no hashes, no
  // plaintext. The cloud reconciles (max) so a reconnect never resets an active
  // lockout nor double-counts.
  'STAFF_PIN_AUTH',
  // 4A: immutable audit-log rows produced at the edge (e.g. a manager step-up
  // discount authorization while the cloud is unreachable). Append-only; the
  // cloud upserts by id, idempotently. Reuses this EXISTING sync channel — no
  // new channel is introduced.
  'AUDIT_LOG',
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
/** 4A: a full audit-log row captured at the edge, replayed to the cloud by id. */
export type AuditLogPayload = Jsonify<AuditLog>;
/**
 * 3B: PIN auth-state pushed up from the edge — COUNTERS ONLY (no pinHash). The
 * cloud reconciles failedAttempts (max) + lockedUntil (later) onto its row.
 */
export interface StaffPinAuthPayload {
  id: string;
  userId: string;
  restaurantId: string;
  failedAttempts: number;
  /** ISO-8601 (or null if not locked). */
  lockedUntil: string | null;
}

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
