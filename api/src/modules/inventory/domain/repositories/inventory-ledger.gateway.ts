import { GoodsReceipt } from '../entities/goods-receipt';
import { StockMovementType } from '../enums';
import { StockConsumptionResult } from '../ports/stock-consumption.port';

export const INVENTORY_LEDGER_GATEWAY = Symbol('InventoryLedgerGateway');

/** A stock layer to be created (received == remaining at creation). */
export interface NewLayerSpec {
  id: string;
  restaurantId: string;
  branchId: string;
  /** 6A: the location ("shelf") this lot sits on. */
  locationId: string;
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
  /** 6A: the location this movement applies to. */
  locationId: string;
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
  /**
   * 6A: when set, the FIFO draw is restricted to this location's lots and the
   * shortfall is attributed here (used by the count adjustment). When omitted,
   * existing callers draw across the item's lots and the shortfall lands on the
   * branch default (Main Storage) — preserving INV-1..4 behavior.
   */
  locationId?: string | null;
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
  /**
   * 7A: the input item's default CONSUMPTION location (6C resolver). The FIFO
   * draw is scoped to this location's lots and any shortfall is attributed here,
   * exactly like serving a dish. Always set by the use case.
   */
  locationId: string;
  baseQty: number;
  trackExpiry: boolean;
  lastUnitCostMicro: bigint | null;
}

/** One scaled output to produce (quantity already × multiplier). */
export interface RunProcessOutputSpec {
  itemId: string;
  /** The output item's branch (§4 — produced layer follows the item). */
  branchId: string;
  /**
   * 7A: location the produced lot lands on = the output item's default
   * CONSUMPTION location (6C resolver), so a processed item is produced where it
   * will later be served from. (6A produced into the branch default; 7A made it
   * per-item.)
   */
  locationId: string;
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
  /** 7A: the location the produced lot landed on (the output item's default). */
  locationId: string;
  layerId: string;
  baseQty: number;
  allocatedCostAmount: number;
}

/** 7A: per-input consumption outcome, for the run audit trail (§4.4). */
export interface RunProcessInputConsumption {
  itemId: string;
  /** The location the input was depleted from (its default consumption location). */
  locationId: string;
  /** Quantity requested (already × multiplier). */
  baseQty: number;
  /** Rolled-up cost of the stock actually drawn for this input. */
  costAmount: number;
  /** True if this input drove the location's on-hand negative. */
  wentNegative: boolean;
}

export interface RunProcessResult {
  runId: string;
  inputCostAmount: number;
  processingCostAmount: number;
  totalCostAmount: number;
  wentNegative: boolean;
  /** 7A: per-input consumption breakdown (item, location, qty, cost). */
  inputs: RunProcessInputConsumption[];
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

  /** 6B within-branch transfer: in ONE transaction, FIFO-consume `baseQty` from
   *  the source location (TRANSFER_OUT), recreate cost-preserving lots at the
   *  destination (TRANSFER_IN, acquiredAt = transfer time), update both on-hand
   *  projections + alerts, and persist the transfer header + consumed slices.
   *  Realizes NO COGS. Throws TransferExceedsOnHand on over-transfer (full
   *  rollback). The caller validates same-branch / A≠B / ACTIVE / Q>0 first. */
  transfer(input: TransferLedgerInput): Promise<TransferLedgerResult>;

  /** 6A correction adjustment (§6): set the actual counted on-hand for an
   *  (item, location). Computes the signed difference vs the current projection
   *  and, in ONE transaction, writes an ADJUSTMENT_IN (surplus) or ADJUSTMENT_OUT
   *  (shortfall) located movement, adjusts the FIFO lots, and updates the on-hand
   *  projection + low-stock alerts. Positive corrections are valued at last known
   *  unit cost (flagged uncosted if none). */
  setCountedOnHand(input: SetCountedOnHandInput): Promise<CountAdjustmentResult>;
}

export interface TransferLedgerInput {
  transferId: string;
  restaurantId: string;
  branchId: string;
  itemId: string;
  fromLocationId: string;
  toLocationId: string;
  baseQty: number;
  /** Item metadata for source FIFO/FEFO ordering + defensive shortfall costing. */
  trackExpiry: boolean;
  lastUnitCostMicro: bigint | null;
  performedByUserId: string;
  occurredAt: Date;
}

/** One consumed source slice relocated to the destination (audit detail). */
export interface TransferSliceRecord {
  sourceLayerId: string | null;
  destinationLayerId: string;
  baseQty: number;
  costAmount: number;
  /** Carrying unit cost (MICRO) — preserved from source to destination. */
  unitCostMicro: bigint;
}

export interface TransferLedgerResult {
  transferId: string;
  slices: TransferSliceRecord[];
  fromOnHandAfter: number;
  toOnHandAfter: number;
  /** True if the source drop crossed at/below its low-stock threshold. */
  lowStockRaised: boolean;
}

export interface SetCountedOnHandInput {
  restaurantId: string;
  branchId: string;
  itemId: string;
  locationId: string;
  /** The actual counted on-hand at this location (>= 0). */
  countedBaseQty: number;
  /** Costs positive corrections; null => the surplus layer is flagged uncosted. */
  lastUnitCostMicro: bigint | null;
  trackExpiry: boolean;
  reason: string | null;
  createdByUserId: string;
  occurredAt: Date;
}

export interface CountAdjustmentResult {
  beforeBaseQty: number;
  afterBaseQty: number;
  /** Signed: + surplus added, - shortfall removed, 0 no-op. */
  deltaBaseQty: number;
  /** True when a positive correction could not be costed (no lastUnitCostMicro). */
  uncosted: boolean;
  /** True when applying the correction crossed at/below the low-stock threshold. */
  lowStockRaised: boolean;
  thresholdBase: number | null;
}

export interface ReverseLedgerInput {
  restaurantId: string;
  refType: string;
  refId: string;
  createdByUserId: string;
  occurredAt: Date;
}
