import {
  BranchInventoryPolicy as PrismaPolicy,
  GoodsReceipt as PrismaGoodsReceipt,
  GoodsReceiptLine as PrismaGoodsReceiptLine,
  InventoryCategory as PrismaCategory,
  InventoryItem as PrismaItem,
  InventoryLocation as PrismaLocation,
  InventoryTransfer as PrismaTransfer,
  InventoryTransferSlice as PrismaTransferSlice,
  StockLayer as PrismaLayer,
  StockMovement as PrismaMovement,
  Supplier as PrismaSupplier,
} from '@prisma/client';
import { BranchInventoryPolicy } from '../../domain/entities/branch-inventory-policy';
import { GoodsReceipt, GoodsReceiptLine } from '../../domain/entities/goods-receipt';
import { InventoryCategory } from '../../domain/entities/inventory-category';
import { InventoryItem } from '../../domain/entities/inventory-item';
import { InventoryLocation } from '../../domain/entities/inventory-location';
import { InventoryTransfer } from '../../domain/entities/inventory-transfer';
import { StockLayer } from '../../domain/entities/stock-layer';
import { StockMovement } from '../../domain/entities/stock-movement';
import { Supplier } from '../../domain/entities/supplier';
import {
  InventoryBaseUnit,
  InventoryItemStatus,
  InventoryLocationStatus,
  InventoryLocationType,
  ItemKind,
  NegativeStockMode,
  StockLayerStatus,
  StockMovementType,
} from '../../domain/enums';
import { AlternateUnit } from '../../domain/value-objects/alternate-unit';

type AlternateUnitJson = { name: string; factor: number };

export class InventoryItemMapper {
  static toDomain(r: PrismaItem): InventoryItem {
    const alternates = Array.isArray(r.alternateUnits)
      ? (r.alternateUnits as unknown as AlternateUnitJson[])
      : [];
    return InventoryItem.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      name: r.name,
      sku: r.sku,
      categoryId: r.categoryId,
      kind: r.kind as ItemKind,
      baseUnit: r.baseUnit as InventoryBaseUnit,
      alternateUnits: AlternateUnit.fromList(alternates),
      trackExpiry: r.trackExpiry,
      lowStockThresholdBase: r.lowStockThresholdBase,
      lastUnitCostMicro: r.lastUnitCostMicro,
      consumptionLocationId: r.consumptionLocationId,
      status: r.status as InventoryItemStatus,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
    });
  }

  static toCreate(i: InventoryItem) {
    return {
      id: i.id,
      restaurantId: i.restaurantId,
      branchId: i.branchId,
      name: i.name,
      sku: i.sku,
      categoryId: i.categoryId,
      kind: i.kind as ItemKind,
      baseUnit: i.baseUnit as InventoryBaseUnit,
      alternateUnits: i.alternateUnits.map((a) => ({ name: a.name, factor: a.factor })),
      trackExpiry: i.trackExpiry,
      lowStockThresholdBase: i.lowStockThresholdBase,
      lastUnitCostMicro: i.lastUnitCostMicro,
      consumptionLocationId: i.consumptionLocationId,
      status: i.status as InventoryItemStatus,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
      deletedAt: i.deletedAt,
    };
  }

  static toUpdate(i: InventoryItem) {
    return {
      name: i.name,
      sku: i.sku,
      categoryId: i.categoryId,
      kind: i.kind as ItemKind,
      baseUnit: i.baseUnit as InventoryBaseUnit,
      alternateUnits: i.alternateUnits.map((a) => ({ name: a.name, factor: a.factor })),
      trackExpiry: i.trackExpiry,
      lowStockThresholdBase: i.lowStockThresholdBase,
      lastUnitCostMicro: i.lastUnitCostMicro,
      consumptionLocationId: i.consumptionLocationId,
      status: i.status as InventoryItemStatus,
      updatedAt: i.updatedAt,
      deletedAt: i.deletedAt,
    };
  }
}

export class InventoryCategoryMapper {
  static toDomain(r: PrismaCategory): InventoryCategory {
    return InventoryCategory.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      name: r.name,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
    });
  }

  static toCreate(c: InventoryCategory) {
    return {
      id: c.id,
      restaurantId: c.restaurantId,
      branchId: c.branchId,
      name: c.name,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      deletedAt: c.deletedAt,
    };
  }

  static toUpdate(c: InventoryCategory) {
    return { name: c.name, updatedAt: c.updatedAt, deletedAt: c.deletedAt };
  }
}

export class SupplierMapper {
  static toDomain(r: PrismaSupplier): Supplier {
    return Supplier.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      name: r.name,
      contact: r.contact,
      note: r.note,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
    });
  }

  static toCreate(s: Supplier) {
    return {
      id: s.id,
      restaurantId: s.restaurantId,
      branchId: s.branchId,
      name: s.name,
      contact: s.contact,
      note: s.note,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      deletedAt: s.deletedAt,
    };
  }

  static toUpdate(s: Supplier) {
    return {
      name: s.name,
      contact: s.contact,
      note: s.note,
      updatedAt: s.updatedAt,
      deletedAt: s.deletedAt,
    };
  }
}

export class GoodsReceiptMapper {
  static toDomain(r: PrismaGoodsReceipt & { lines: PrismaGoodsReceiptLine[] }): GoodsReceipt {
    return GoodsReceipt.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      supplierId: r.supplierId,
      reference: r.reference,
      receivedAt: r.receivedAt,
      note: r.note,
      createdByUserId: r.createdByUserId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      lines: r.lines.map(
        (l) =>
          new GoodsReceiptLine({
            id: l.id,
            branchId: l.branchId,
            itemId: l.itemId,
            enteredUnit: l.enteredUnit,
            enteredQty: l.enteredQty,
            baseQty: l.baseQty,
            lineTotalCostAmount: l.lineTotalCostAmount,
            expiryDate: l.expiryDate,
          }),
      ),
    });
  }
}

export class InventoryLocationMapper {
  static toDomain(r: PrismaLocation): InventoryLocation {
    return InventoryLocation.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      name: r.name,
      systemType: r.systemType as InventoryLocationType,
      isDefault: r.isDefault,
      status: r.status as InventoryLocationStatus,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
    });
  }

  static toCreate(l: InventoryLocation) {
    return {
      id: l.id,
      restaurantId: l.restaurantId,
      branchId: l.branchId,
      name: l.name,
      systemType: l.systemType as InventoryLocationType,
      isDefault: l.isDefault,
      status: l.status as InventoryLocationStatus,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      deletedAt: l.deletedAt,
    };
  }

  static toUpdate(l: InventoryLocation) {
    return {
      name: l.name,
      isDefault: l.isDefault,
      status: l.status as InventoryLocationStatus,
      updatedAt: l.updatedAt,
      deletedAt: l.deletedAt,
    };
  }
}

export class BranchInventoryPolicyMapper {
  static toDomain(r: PrismaPolicy): BranchInventoryPolicy {
    return BranchInventoryPolicy.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      negativeStockMode: r.negativeStockMode as NegativeStockMode,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }
}

export class InventoryTransferMapper {
  static toDomain(
    r: PrismaTransfer & { slices?: PrismaTransferSlice[] },
  ): InventoryTransfer {
    return InventoryTransfer.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      itemId: r.itemId,
      fromLocationId: r.fromLocationId,
      toLocationId: r.toLocationId,
      quantity: r.quantity,
      performedByUserId: r.performedByUserId,
      occurredAt: r.occurredAt,
      createdAt: r.createdAt,
      slices: (r.slices ?? []).map((s) => ({
        id: s.id,
        sourceLayerId: s.sourceLayerId,
        destinationLayerId: s.destinationLayerId,
        baseQty: s.baseQty,
        costAmount: s.costAmount,
        unitCostMicro: s.unitCostMicro,
      })),
    });
  }
}

export class StockLayerMapper {
  static toDomain(r: PrismaLayer): StockLayer {
    return StockLayer.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      itemId: r.itemId,
      sourceReceiptLineId: r.sourceReceiptLineId,
      baseQtyReceived: r.baseQtyReceived,
      baseQtyRemaining: r.baseQtyRemaining,
      lineTotalCostAmount: r.lineTotalCostAmount,
      receivedAt: r.receivedAt,
      expiryDate: r.expiryDate,
      status: r.status as StockLayerStatus,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }
}

export class StockMovementMapper {
  static toDomain(r: PrismaMovement): StockMovement {
    return StockMovement.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      locationId: r.locationId,
      itemId: r.itemId,
      type: r.type as StockMovementType,
      baseQty: r.baseQty,
      costAmount: r.costAmount,
      layerId: r.layerId,
      reason: r.reason,
      refType: r.refType,
      refId: r.refId,
      occurredAt: r.occurredAt,
      createdByUserId: r.createdByUserId,
      createdAt: r.createdAt,
    });
  }
}
