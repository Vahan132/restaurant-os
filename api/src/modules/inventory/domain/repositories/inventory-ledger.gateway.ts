import { GoodsReceipt } from '../entities/goods-receipt';
import { StockMovementType } from '../enums';
import { StockConsumptionResult } from '../ports/stock-consumption.port';

export const INVENTORY_LEDGER_GATEWAY = Symbol('InventoryLedgerGateway');

/** A stock layer to be created (received == remaining at creation). */
export interface NewLayerSpec {
  id: string;
  restaurantId: string;
  branchId: string;
  itemId: string;
  sourceReceiptLineId: string | null;
  baseQtyReceived: number;
  baseQtyRemaining: number;
  lineTotalCostAmount: number;
  receivedAt: Date;
  expiryDate: Date | null;
}

/** A movement to append to the ledger (signed baseQty/costAmount). */
export interface NewMovementSpec {
  id: string;
  restaurantId: string;
  branchId: string;
  itemId: string;
  type: StockMovementType;
  baseQty: number;
  costAmount: number;
  layerId: string | null;
  reason: string | null;
  refType: string | null;
  refId: string | null;
  occurredAt: Date;
  createdByUserId: string;
}

/** Refresh of an item's last-known MICRO unit cost (from a receipt line). */
export interface ItemCostUpdate {
  itemId: string;
  lastUnitCostMicro: bigint;
}

export interface RecordReceiptInput {
  receipt: GoodsReceipt;
  layers: NewLayerSpec[];
  movements: NewMovementSpec[];
  costUpdates: ItemCostUpdate[];
}

export interface RecordInboundInput {
  layer: NewLayerSpec;
  movement: NewMovementSpec;
}

export interface GatewayConsumeInput {
  restaurantId: string;
  /** The acted-on ITEM's branch (§4 — stock follows the item, never the request). */
  branchId: string;
  itemId: string;
  baseQty: number;
  type: StockMovementType;
  reason: string | null;
  refType: string | null;
  refId: string | null;
  createdByUserId: string;
  occurredAt: Date;
  /** Item metadata captured by the caller (drives FEFO vs FIFO + costing). */
  trackExpiry: boolean;
  lastUnitCostMicro: bigint | null;
}

/** Header + cost snapshot for a production run (INV-2). */
export interface RunProcessHeader {
  id: string;
  restaurantId: string;
  branchId: string;
  processId: string;
  multiplier: number;
  /** Per-run processing cost snapshot (NOT scaled by multiplier). */
  processingCostAmount: number;
  runAt: Date;
  note: string | null;
  createdByUserId: string;
}

/** One scaled input to consume (quantity already × multiplier). */
export interface RunProcessInputSpec {
  itemId: string;
  /** The input item's branch (§4 — drawn stock follows the item). */
  branchId: string;
  baseQty: number;
  trackExpiry: boolean;
  lastUnitCostMicro: bigint | null;
}

/** One scaled output to produce (quantity already × multiplier). */
export interface RunProcessOutputSpec {
  itemId: string;
  /** The output item's branch (§4 — produced layer follows the item). */
  branchId: string;
  baseQty: number;
  isPrimary: boolean;
  costShareBps: number | null;
  /** Only set when the output item tracks expiry. */
  expiryDate: Date | null;
}

export interface RunProcessInput {
  run: RunProcessHeader;
  inputs: RunProcessInputSpec[];
  outputs: RunProcessOutputSpec[];
}

export interface RunProcessAllocation {
  itemId: string;
  layerId: string;
  baseQty: number;
  allocatedCostAmount: number;
}

export interface RunProcessResult {
  runId: string;
  inputCostAmount: number;
  processingCostAmount: number;
  totalCostAmount: number;
  wentNegative: boolean;
  allocations: RunProcessAllocation[];
}

/**
 * InventoryLedgerGateway — the transactional write side of the warehouse. Each
 * method is ONE atomic database transaction (CONVENTIONS: whole receipt is one
 * transaction). The append-only ledger is the source of truth for on-hand qty.
 */
export interface InventoryLedgerGateway {
  /** Persist a goods receipt: header + lines + one layer/movement per line +
   *  refresh each item's lastUnitCostMicro — atomically. */
  recordReceipt(input: RecordReceiptInput): Promise<void>;

  /** Persist an inbound adjustment: one layer + one ADJUSTMENT_IN movement. */
  recordInboundAdjustment(input: RecordInboundInput): Promise<void>;

  /** Draw stock down FIFO/FEFO inside a transaction, append OUT movements (one
   *  per layer drawn + a shortfall movement when negative). Never throws on
   *  insufficient stock. */
  consume(input: GatewayConsumeInput): Promise<StockConsumptionResult>;

  /** Execute a production run in ONE transaction: FIFO/FEFO-consume every input
   *  (PROCESS_OUT), roll input cost + processing cost into the produced output
   *  layers (PROCESS_IN), and persist the ProcessRun. Reuses the same FIFO core
   *  as consume(); never throws on insufficient input stock. */
  runProcess(input: RunProcessInput): Promise<RunProcessResult>;

  /** Reverse all un-reversed OUT movements for a (refType, refId) in ONE
   *  transaction: restore each source layer, emit a CONSUMPTION_REVERSAL per
   *  original, and stamp reversedAt on the originals. Idempotent (no-op if
   *  already reversed). Returns how many movements were reversed. */
  reverse(input: ReverseLedgerInput): Promise<number>;
}

export interface ReverseLedgerInput {
  restaurantId: string;
  refType: string;
  refId: string;
  createdByUserId: string;
  occurredAt: Date;
}
