import { ApiProperty } from '@nestjs/swagger';
import { CatalogLocalizedName } from '../../../platform-catalog/domain/repositories/catalog-item.reader';
import { GoodsReceipt } from '../../domain/entities/goods-receipt';
import { InventoryCategory } from '../../domain/entities/inventory-category';
import { InventoryItem } from '../../domain/entities/inventory-item';
import { StockLayer } from '../../domain/entities/stock-layer';
import { StockMovement } from '../../domain/entities/stock-movement';
import { Supplier } from '../../domain/entities/supplier';
import { StockConsumptionResult } from '../../domain/ports/stock-consumption.port';
import { StockRow } from '../ports/inventory-stock.reader';

class AlternateUnitView {
  @ApiProperty() name!: string;
  @ApiProperty() factor!: number;
}

/**
 * PLATCAT-ADOPT-1B: the platform catalog's trilingual name, resolved live for an
 * adopted item. Present (non-null) only when the item carries a catalogItemId.
 */
export class CatalogNameView {
  @ApiProperty() hy!: string;
  @ApiProperty() ru!: string;
  @ApiProperty() en!: string;
}

export class InventoryItemResponse {
  @ApiProperty() id!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'PLATCAT-ADOPT-1B: local name; null for an adopted item (use catalogName). ' +
      'Client display = catalogName ? catalogName[locale] : name.',
  })
  name!: string | null;
  @ApiProperty({
    nullable: true,
    type: CatalogNameView,
    description: 'Live-resolved platform catalog name {hy,ru,en}; present when adopted.',
  })
  catalogName!: CatalogLocalizedName | null;
  @ApiProperty({ nullable: true, type: String }) sku!: string | null;
  @ApiProperty({ nullable: true, type: String }) categoryId!: string | null;
  @ApiProperty({ enum: ['RAW', 'PROCESSED'] }) kind!: string;
  @ApiProperty({ enum: ['GRAM', 'MILLILITER', 'PIECE'] }) baseUnit!: string;
  @ApiProperty({ type: [AlternateUnitView] }) alternateUnits!: AlternateUnitView[];
  @ApiProperty() trackExpiry!: boolean;
  @ApiProperty({ nullable: true, type: Number }) lowStockThresholdBase!: number | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Last unit cost at MICRO precision (BigInt as string).',
  })
  lastUnitCostMicro!: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description: '6C: per-item consumption location (null => branch default Main Storage).',
  })
  consumptionLocationId!: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'CATALOG-1: platform CatalogItem this item was adopted from (null = custom).',
  })
  catalogItemId!: string | null;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] }) status!: string;

  static from(
    i: InventoryItem,
    catalogName: CatalogLocalizedName | null = null,
  ): InventoryItemResponse {
    return {
      id: i.id,
      restaurantId: i.restaurantId,
      branchId: i.branchId,
      name: i.name,
      catalogName,
      sku: i.sku,
      categoryId: i.categoryId,
      kind: i.kind,
      baseUnit: i.baseUnit,
      alternateUnits: i.alternateUnits.map((a) => ({ name: a.name, factor: a.factor })),
      trackExpiry: i.trackExpiry,
      lowStockThresholdBase: i.lowStockThresholdBase,
      lastUnitCostMicro: i.lastUnitCostMicro === null ? null : i.lastUnitCostMicro.toString(),
      consumptionLocationId: i.consumptionLocationId,
      catalogItemId: i.catalogItemId,
      status: i.status,
    };
  }
}

export class InventoryCategoryResponse {
  @ApiProperty() id!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty() name!: string;

  static from(c: InventoryCategory): InventoryCategoryResponse {
    return { id: c.id, restaurantId: c.restaurantId, name: c.name };
  }
}

export class SupplierResponse {
  @ApiProperty() id!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String }) contact!: string | null;
  @ApiProperty({ nullable: true, type: String }) note!: string | null;

  static from(s: Supplier): SupplierResponse {
    return {
      id: s.id,
      restaurantId: s.restaurantId,
      name: s.name,
      contact: s.contact,
      note: s.note,
    };
  }
}

export class GoodsReceiptLineResponse {
  @ApiProperty() id!: string;
  @ApiProperty() itemId!: string;
  @ApiProperty() enteredUnit!: string;
  @ApiProperty() enteredQty!: number;
  @ApiProperty() baseQty!: number;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  @ApiProperty() lineTotalCost_amount!: number;
  @ApiProperty({ nullable: true, type: String }) expiryDate!: string | null;
}

export class GoodsReceiptResponse {
  @ApiProperty() id!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty({ nullable: true, type: String }) supplierId!: string | null;
  @ApiProperty({ nullable: true, type: String }) reference!: string | null;
  @ApiProperty() receivedAt!: string;
  @ApiProperty({ nullable: true, type: String }) note!: string | null;
  @ApiProperty() createdByUserId!: string;
  @ApiProperty({ type: [GoodsReceiptLineResponse] }) lines!: GoodsReceiptLineResponse[];

  static from(r: GoodsReceipt): GoodsReceiptResponse {
    return {
      id: r.id,
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      supplierId: r.supplierId,
      reference: r.reference,
      receivedAt: r.receivedAt.toISOString(),
      note: r.note,
      createdByUserId: r.createdByUserId,
      lines: r.lines.map((l) => ({
        id: l.id,
        itemId: l.itemId,
        enteredUnit: l.enteredUnit,
        enteredQty: l.enteredQty,
        baseQty: l.baseQty,
        lineTotalCost_amount: l.lineTotalCostAmount,
        expiryDate: l.expiryDate ? l.expiryDate.toISOString() : null,
      })),
    };
  }
}

export class StockLayerResponse {
  @ApiProperty() layerId!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty() itemId!: string;
  @ApiProperty() baseQtyReceived!: number;
  @ApiProperty() baseQtyRemaining!: number;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  @ApiProperty() lineTotalCost_amount!: number;
  @ApiProperty({ description: 'Derived unit cost at MICRO precision (BigInt as string).' })
  unitCostMicro!: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  @ApiProperty({ description: 'Derived costed value of the remaining qty.' })
  remainingValue_amount!: number;
  @ApiProperty() receivedAt!: string;
  @ApiProperty({ nullable: true, type: String }) expiryDate!: string | null;
  @ApiProperty({ enum: ['OPEN', 'DEPLETED'] }) status!: string;

  static from(l: StockLayer): StockLayerResponse {
    return {
      layerId: l.id,
      branchId: l.branchId,
      itemId: l.itemId,
      baseQtyReceived: l.baseQtyReceived,
      baseQtyRemaining: l.baseQtyRemaining,
      lineTotalCost_amount: l.lineTotalCostAmount,
      unitCostMicro: l.derivedUnitCostMicro.toString(),
      remainingValue_amount: l.remainingValueAmount,
      receivedAt: l.receivedAt.toISOString(),
      expiryDate: l.expiryDate ? l.expiryDate.toISOString() : null,
      status: l.status,
    };
  }
}

export class StockMovementResponse {
  @ApiProperty() id!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty() locationId!: string;
  @ApiProperty() itemId!: string;
  @ApiProperty({
    enum: [
      'OPENING',
      'RECEIPT_IN',
      'ADJUSTMENT_IN',
      'ADJUSTMENT_OUT',
      'CONSUMPTION_OUT',
      'WRITE_OFF_OUT',
      'PROCESS_OUT',
      'PROCESS_IN',
      'CONSUMPTION_REVERSAL',
      'TRANSFER_OUT',
      'TRANSFER_IN',
    ],
  })
  type!: string;
  @ApiProperty({ description: 'Signed base qty (+ in, - out).' }) baseQty!: number;
  @ApiProperty({ description: 'Signed costed value (minor units).' }) costAmount!: number;
  @ApiProperty({ nullable: true, type: String }) layerId!: string | null;
  @ApiProperty({ nullable: true, type: String }) reason!: string | null;
  @ApiProperty({ nullable: true, type: String }) refType!: string | null;
  @ApiProperty({ nullable: true, type: String }) refId!: string | null;
  @ApiProperty() occurredAt!: string;
  @ApiProperty() createdByUserId!: string;

  static from(m: StockMovement): StockMovementResponse {
    return {
      id: m.id,
      branchId: m.branchId,
      locationId: m.locationId,
      itemId: m.itemId,
      type: m.type,
      baseQty: m.baseQty,
      costAmount: m.costAmount,
      layerId: m.layerId,
      reason: m.reason,
      refType: m.refType,
      refId: m.refId,
      occurredAt: m.occurredAt.toISOString(),
      createdByUserId: m.createdByUserId,
    };
  }
}

export class StockRowResponse {
  @ApiProperty() itemId!: string;
  @ApiProperty({ nullable: true, type: String, description: 'Local name; null when adopted (use catalogName).' })
  name!: string | null;
  @ApiProperty({ nullable: true, type: CatalogNameView, description: 'Live catalog name {hy,ru,en} when adopted.' })
  catalogName!: CatalogLocalizedName | null;
  @ApiProperty({ nullable: true, type: String }) sku!: string | null;
  @ApiProperty({ nullable: true, type: String }) categoryId!: string | null;
  @ApiProperty({ enum: ['RAW', 'PROCESSED'] }) kind!: string;
  @ApiProperty({ enum: ['GRAM', 'MILLILITER', 'PIECE'] }) baseUnit!: string;
  @ApiProperty() onHandBase!: number;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  @ApiProperty() valuation_amount!: number;
  @ApiProperty({ nullable: true, type: Number }) lowStockThresholdBase!: number | null;
  @ApiProperty() lowStock!: boolean;
  @ApiProperty({ nullable: true, type: String }) earliestExpiry!: string | null;

  static from(r: StockRow): StockRowResponse {
    return {
      itemId: r.itemId,
      name: r.name,
      catalogName: r.catalogName ?? null,
      sku: r.sku,
      categoryId: r.categoryId,
      kind: r.kind,
      baseUnit: r.baseUnit,
      onHandBase: r.onHandBase,
      valuation_amount: r.valuationAmount,
      lowStockThresholdBase: r.lowStockThresholdBase,
      lowStock: r.lowStock,
      earliestExpiry: r.earliestExpiry ? r.earliestExpiry.toISOString() : null,
    };
  }
}

export class AdjustmentResultResponse {
  @ApiProperty() itemId!: string;
  @ApiProperty({ enum: ['IN', 'OUT'] }) direction!: string;
  @ApiProperty() baseQty!: number;
  @ApiProperty({ description: 'True if an OUT drove on-hand negative (warn, not blocked).' })
  wentNegative!: boolean;
  @ApiProperty({ description: 'True if the entry could not be costed.' }) uncosted!: boolean;

  static fromConsumption(
    direction: string,
    baseQty: number,
    r: StockConsumptionResult,
  ): AdjustmentResultResponse {
    return {
      itemId: r.itemId,
      direction,
      baseQty,
      wentNegative: r.wentNegative,
      uncosted: r.uncosted,
    };
  }
}
