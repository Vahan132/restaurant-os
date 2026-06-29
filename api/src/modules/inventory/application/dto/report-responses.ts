import { ApiProperty } from '@nestjs/swagger';
import {
  StockOnHandReportRow,
  ValuationBucket,
  ValuationSummary,
} from '../ports/inventory-report.reader';

export class StockOnHandRowResponse {
  @ApiProperty() branchId!: string;
  @ApiProperty() locationId!: string;
  @ApiProperty() locationName!: string;
  @ApiProperty() itemId!: string;
  @ApiProperty() itemName!: string;
  @ApiProperty({ nullable: true, type: String }) sku!: string | null;
  @ApiProperty({ nullable: true, type: String }) categoryId!: string | null;
  @ApiProperty() baseUnit!: string;
  @ApiProperty({ description: 'On-hand in base units (may be negative).' }) quantity!: number;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  @ApiProperty({ description: 'FIFO value (minor units); negative valued at last known unit cost.' })
  valuation_amount!: number;
  @ApiProperty({ nullable: true, type: Number }) lowStockThresholdBase!: number | null;
  @ApiProperty() lowStock!: boolean;

  static from(r: StockOnHandReportRow): StockOnHandRowResponse {
    return {
      branchId: r.branchId,
      locationId: r.locationId,
      locationName: r.locationName,
      itemId: r.itemId,
      itemName: r.itemName,
      sku: r.sku,
      categoryId: r.categoryId,
      baseUnit: r.baseUnit,
      quantity: r.quantity,
      valuation_amount: r.valuationAmount,
      lowStockThresholdBase: r.lowStockThresholdBase,
      lowStock: r.lowStock,
    };
  }
}

export class ValuationBucketResponse {
  @ApiProperty() branchId!: string;
  @ApiProperty({ nullable: true, type: String, description: 'Null for a per-branch bucket.' })
  locationId!: string | null;
  @ApiProperty({ nullable: true, type: String }) locationName!: string | null;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  @ApiProperty() valuation_amount!: number;

  static from(b: ValuationBucket): ValuationBucketResponse {
    return {
      branchId: b.branchId,
      locationId: b.locationId,
      locationName: b.locationName,
      valuation_amount: b.valuationAmount,
    };
  }
}

export class ValuationSummaryResponse {
  @ApiProperty({ type: [ValuationBucketResponse] }) byLocation!: ValuationBucketResponse[];
  @ApiProperty({ type: [ValuationBucketResponse] }) byBranch!: ValuationBucketResponse[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  @ApiProperty({ description: 'Aggregate value across every in-scope branch.' })
  totalValuation_amount!: number;

  static from(s: ValuationSummary): ValuationSummaryResponse {
    return {
      byLocation: s.byLocation.map(ValuationBucketResponse.from),
      byBranch: s.byBranch.map(ValuationBucketResponse.from),
      totalValuation_amount: s.totalValuationAmount,
    };
  }
}
