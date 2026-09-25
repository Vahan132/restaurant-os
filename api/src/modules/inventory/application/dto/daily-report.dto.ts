/* eslint-disable @typescript-eslint/naming-convention */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';
import { AlternateUnitView, CatalogNameView } from './responses';

export class DailyInventoryReportQuery {
  @ApiPropertyOptional({
    description: 'Business day YYYY-MM-DD in the restaurant timezone. Defaults to today.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @ApiPropertyOptional({
    description: 'Range start YYYY-MM-DD (inclusive). Overrides `date` when given.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({
    description: 'Range end YYYY-MM-DD (inclusive). Defaults to `from`.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @ApiPropertyOptional({
    enum: ['true', 'false'],
    description: 'Re-freeze a closed day from the ledger instead of serving its snapshot.',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  refresh?: string;
}

export class QtyValueView {
  @ApiProperty({ description: 'Base units, signed as it affects on-hand.' }) qty!: number;
  @ApiProperty({ description: 'Minor units, signed.' }) value!: number;
}

export class DailyItemRowView {
  @ApiProperty() itemId!: string;
  @ApiProperty({ nullable: true, type: String }) name!: string | null;
  @ApiProperty({ nullable: true, type: CatalogNameView }) catalogName!: CatalogNameView | null;
  @ApiProperty({ enum: ['GRAM', 'MILLILITER', 'PIECE'] }) baseUnit!: string;
  @ApiProperty({ type: [AlternateUnitView] }) alternateUnits!: AlternateUnitView[];
  @ApiProperty({ nullable: true, type: String }) categoryName!: string | null;
  @ApiProperty({ type: QtyValueView }) opening!: QtyValueView;
  @ApiProperty({ type: QtyValueView }) received!: QtyValueView;
  @ApiProperty({ type: QtyValueView, description: 'Sold via dishes, net of voids.' })
  sold!: QtyValueView;
  @ApiProperty({ type: QtyValueView }) produced!: QtyValueView;
  @ApiProperty({ type: QtyValueView }) usedInProduction!: QtyValueView;
  @ApiProperty({ type: QtyValueView }) wasted!: QtyValueView;
  @ApiProperty({ type: QtyValueView, description: 'Physical count corrections (inconsistency).' })
  countVariance!: QtyValueView;
  @ApiProperty({ type: QtyValueView }) adjusted!: QtyValueView;
  @ApiProperty({ type: QtyValueView }) transferred!: QtyValueView;
  @ApiProperty({ type: QtyValueView }) closing!: QtyValueView;
  @ApiProperty({ nullable: true, type: String }) currentUnitCostMicro!: string | null;
}

export class DailyTotalsView {
  @ApiProperty() openingValue!: number;
  @ApiProperty() receivedValue!: number;
  @ApiProperty() soldValue!: number;
  @ApiProperty() producedValue!: number;
  @ApiProperty() usedInProductionValue!: number;
  @ApiProperty() wastedValue!: number;
  @ApiProperty() countVarianceValue!: number;
  @ApiProperty() adjustedValue!: number;
  @ApiProperty() closingValue!: number;
  @ApiProperty() itemsMoved!: number;
  @ApiProperty() negativeItems!: number;
}

export class DailyItemCostChangeView {
  @ApiProperty() itemId!: string;
  @ApiProperty({ nullable: true, type: String }) name!: string | null;
  @ApiProperty({ nullable: true, type: CatalogNameView }) catalogName!: CatalogNameView | null;
  @ApiProperty({ enum: ['GRAM', 'MILLILITER', 'PIECE'] }) baseUnit!: string;
  @ApiProperty({ nullable: true, type: String }) oldUnitCostMicro!: string | null;
  @ApiProperty() newUnitCostMicro!: string;
  @ApiProperty({ nullable: true, type: String }) supplierName!: string | null;
  @ApiProperty() trigger!: string;
  @ApiProperty() occurredAt!: string;
}

export class DailyDishCostChangeView {
  @ApiProperty() recipeId!: string;
  @ApiProperty() menuItemId!: string;
  @ApiProperty({ nullable: true, type: String }) menuItemName!: string | null;
  @ApiProperty({ nullable: true, type: Number }) oldCostAmount!: number | null;
  @ApiProperty() newCostAmount!: number;
  @ApiProperty({ nullable: true, type: String }) causeItemId!: string | null;
  @ApiProperty({ nullable: true, type: String }) causeItemName!: string | null;
  @ApiProperty({ nullable: true, type: CatalogNameView })
  causeCatalogName!: CatalogNameView | null;
  @ApiProperty() occurredAt!: string;
}

export class DailyInventoryReportResponse {
  @ApiProperty() branchId!: string;
  @ApiProperty({ description: 'First business day of the report.' }) businessDate!: string;
  @ApiProperty({ description: 'Last business day (inclusive); = businessDate for one day.' })
  endDate!: string;
  @ApiProperty() timezone!: string;
  @ApiProperty() from!: string;
  @ApiProperty() to!: string;
  @ApiProperty() generatedAt!: string;
  @ApiProperty({ description: 'Served from the frozen end-of-day snapshot.' }) frozen!: boolean;
  @ApiProperty({ description: 'The business day is still running.' }) inProgress!: boolean;
  @ApiProperty({ type: DailyTotalsView }) totals!: DailyTotalsView;
  @ApiProperty({ type: [DailyItemRowView] }) items!: DailyItemRowView[];
  @ApiProperty({ type: [DailyItemCostChangeView] }) itemCostChanges!: DailyItemCostChangeView[];
  @ApiProperty({ type: [DailyDishCostChangeView] }) dishCostChanges!: DailyDishCostChangeView[];
}
