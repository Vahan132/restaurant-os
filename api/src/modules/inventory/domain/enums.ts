/** Inventory domain enums (string values mirror the Prisma enums). Pure domain. */

/** Catalog kind. PROCESSED items are normally produced by a Process (later prompt)
 *  but may be created manually here; layers/movements/FIFO behave identically. */
export enum ItemKind {
  RAW = 'RAW',
  PROCESSED = 'PROCESSED',
}

/** Canonical, integer-valued base units. ALL stored quantities are integers in
 *  the item's base unit. */
export enum InventoryBaseUnit {
  GRAM = 'GRAM',
  MILLILITER = 'MILLILITER',
  PIECE = 'PIECE',
}

export enum InventoryItemStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum StockLayerStatus {
  OPEN = 'OPEN',
  DEPLETED = 'DEPLETED',
}

/** Append-only movement ledger types. Sign convention: + in, - out. */
export enum StockMovementType {
  RECEIPT_IN = 'RECEIPT_IN',
  ADJUSTMENT_IN = 'ADJUSTMENT_IN',
  ADJUSTMENT_OUT = 'ADJUSTMENT_OUT',
  CONSUMPTION_OUT = 'CONSUMPTION_OUT',
  WRITE_OFF_OUT = 'WRITE_OFF_OUT',
  /** Input consumed by a production run (INV-2). */
  PROCESS_OUT = 'PROCESS_OUT',
  /** Output produced by a production run (INV-2). */
  PROCESS_IN = 'PROCESS_IN',
  /** Compensating + movement that reverses a prior OUT (INV-3). */
  CONSUMPTION_REVERSAL = 'CONSUMPTION_REVERSAL',
}

/** The OUT movement types that a consumption reversal can compensate. */
export const OUT_MOVEMENT_TYPES: ReadonlyArray<StockMovementType> = [
  StockMovementType.ADJUSTMENT_OUT,
  StockMovementType.CONSUMPTION_OUT,
  StockMovementType.WRITE_OFF_OUT,
  StockMovementType.PROCESS_OUT,
];

/** refType marker linking stock movements to an order line (INV-3). */
export const ORDER_LINE_REF_TYPE = 'ORDER_LINE';

/** refType marker linking stock movements to a write-off (INV-4). */
export const WRITE_OFF_REF_TYPE = 'WRITE_OFF';

/** Reason codes for stock write-offs (INV-4). */
export enum WriteOffReason {
  STAFF_MEAL = 'STAFF_MEAL',
  SPOILAGE = 'SPOILAGE',
  WASTE = 'WASTE',
  BREAKAGE = 'BREAKAGE',
  THEFT = 'THEFT',
  OTHER = 'OTHER',
}

/** A write-off line either writes off a raw item or explodes a dish recipe. */
export enum WriteOffLineKind {
  ITEM = 'ITEM',
  DISH = 'DISH',
}

/** Process definition status (catalog). */
export enum ProcessStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

/** refType marker linking run-produced layers/movements back to a ProcessRun. */
export const PROCESS_RUN_REF_TYPE = 'PROCESS_RUN';

/** Direction for manual adjustments (DTO/use-case level, not persisted directly). */
export enum AdjustmentDirection {
  IN = 'IN',
  OUT = 'OUT',
}

/** Generic adjustment reasons. Reason-coded write-offs are a later prompt. */
export enum AdjustmentReason {
  OPENING_BALANCE = 'OPENING_BALANCE',
  STOCK_COUNT = 'STOCK_COUNT',
  CORRECTION = 'CORRECTION',
}
