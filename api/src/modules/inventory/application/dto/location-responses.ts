import { ApiProperty } from '@nestjs/swagger';
import { CatalogLocalizedName } from '../../../platform-catalog/domain/repositories/catalog-item.reader';
import { BranchInventoryPolicy } from '../../domain/entities/branch-inventory-policy';
import { InventoryLocation } from '../../domain/entities/inventory-location';
import { LowStockAlertRow } from '../ports/low-stock-alert.reader';
import { OnHandRow } from '../ports/stock-on-hand.reader';
import { SetCountedOnHandResult } from '../commands/set-counted-on-hand.usecase';
import { CatalogNameView } from './responses';

export class InventoryLocationResponse {
  @ApiProperty() id!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['KITCHEN', 'BAR', 'MAIN_STORAGE', 'CUSTOM'] }) systemType!: string;
  @ApiProperty() isDefault!: boolean;
  @ApiProperty({ description: 'System locations (Main Storage / Kitchen / Bar) cannot be deleted.' })
  isSystem!: boolean;
  @ApiProperty({ enum: ['ACTIVE', 'ARCHIVED'] }) status!: string;

  static from(l: InventoryLocation): InventoryLocationResponse {
    return {
      id: l.id,
      restaurantId: l.restaurantId,
      branchId: l.branchId,
      name: l.name,
      systemType: l.systemType,
      isDefault: l.isDefault,
      isSystem: l.isSystem,
      status: l.status,
    };
  }
}

export class OnHandRowResponse {
  @ApiProperty() itemId!: string;
  @ApiProperty({ nullable: true, type: String, description: 'Local name; null when adopted (use catalogName).' })
  itemName!: string | null;
  @ApiProperty({ nullable: true, type: CatalogNameView, description: 'Live catalog name {hy,ru,en} when adopted.' })
  catalogName!: CatalogLocalizedName | null;
  @ApiProperty() baseUnit!: string;
  @ApiProperty() locationId!: string;
  @ApiProperty() locationName!: string;
  @ApiProperty({ description: 'On-hand in base units (may be negative).' }) quantity!: number;
  @ApiProperty({ nullable: true, type: Number }) lowStockThresholdBase!: number | null;
  @ApiProperty() lowStock!: boolean;

  static from(r: OnHandRow): OnHandRowResponse {
    return {
      itemId: r.itemId,
      itemName: r.itemName,
      catalogName: r.catalogName ?? null,
      baseUnit: r.baseUnit,
      locationId: r.locationId,
      locationName: r.locationName,
      quantity: r.quantity,
      lowStockThresholdBase: r.lowStockThresholdBase,
      lowStock: r.lowStock,
    };
  }
}

export class BranchInventoryPolicyResponse {
  @ApiProperty() restaurantId!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty({ enum: ['ALLOW', 'WARN', 'BLOCK'] }) negativeStockMode!: string;

  static from(p: BranchInventoryPolicy): BranchInventoryPolicyResponse {
    return {
      restaurantId: p.restaurantId,
      branchId: p.branchId,
      negativeStockMode: p.negativeStockMode,
    };
  }
}

export class LowStockAlertResponse {
  @ApiProperty() id!: string;
  @ApiProperty() itemId!: string;
  @ApiProperty({ nullable: true, type: String, description: 'Local name; null when adopted (use catalogName).' })
  itemName!: string | null;
  @ApiProperty({ nullable: true, type: CatalogNameView, description: 'Live catalog name {hy,ru,en} when adopted.' })
  catalogName!: CatalogLocalizedName | null;
  @ApiProperty() locationId!: string;
  @ApiProperty() locationName!: string;
  @ApiProperty() thresholdBase!: number;
  @ApiProperty() onHandBase!: number;
  @ApiProperty({ enum: ['OPEN', 'RESOLVED'] }) status!: string;
  @ApiProperty() raisedAt!: string;
  @ApiProperty({ nullable: true, type: String }) resolvedAt!: string | null;

  static from(r: LowStockAlertRow): LowStockAlertResponse {
    return {
      id: r.id,
      itemId: r.itemId,
      itemName: r.itemName,
      catalogName: r.catalogName ?? null,
      locationId: r.locationId,
      locationName: r.locationName,
      thresholdBase: r.thresholdBase,
      onHandBase: r.onHandBase,
      status: r.status,
      raisedAt: r.raisedAt.toISOString(),
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    };
  }
}

export class CountAdjustmentResultResponse {
  @ApiProperty() itemId!: string;
  @ApiProperty() locationId!: string;
  @ApiProperty() beforeBaseQty!: number;
  @ApiProperty() afterBaseQty!: number;
  @ApiProperty({ description: 'Signed correction (+ surplus / - shortfall / 0 no-op).' })
  deltaBaseQty!: number;
  @ApiProperty({ description: 'True if a positive correction could not be costed.' })
  uncosted!: boolean;
  @ApiProperty({ description: 'True if the correction crossed at/below the low-stock threshold.' })
  lowStockRaised!: boolean;

  static from(r: SetCountedOnHandResult): CountAdjustmentResultResponse {
    return {
      itemId: r.itemId,
      locationId: r.locationId,
      beforeBaseQty: r.beforeBaseQty,
      afterBaseQty: r.afterBaseQty,
      deltaBaseQty: r.deltaBaseQty,
      uncosted: r.uncosted,
      lowStockRaised: r.lowStockRaised,
    };
  }
}
