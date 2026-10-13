import { ApiProperty } from '@nestjs/swagger';

/**
 * Analytics response DTOs for the IMPORTED-SALES surface. Every payload carries
 * `source: 'IMPORTED'` so consumers always see that this data is non-fiscal,
 * externally-loaded — never conflated with the orders-based fiscal reports.
 */
const SOURCE = 'IMPORTED' as const;
export type ImportedSource = typeof SOURCE;

export class ImportedSalesSummaryResponse {
  @ApiProperty({ enum: [SOURCE], description: 'Always "IMPORTED" (non-fiscal).' })
  source: ImportedSource = SOURCE;

  @ApiProperty({ description: 'Sum of line totals (minor units). NON-FISCAL.' })
  totalRevenueAmount!: number;

  @ApiProperty() saleCount!: number;
  @ApiProperty() totalQuantity!: number;
}

export class ImportedItemRowResponse {
  @ApiProperty({ enum: [SOURCE] })
  source: ImportedSource = SOURCE;

  @ApiProperty({ nullable: true, type: String }) itemId!: string | null;
  @ApiProperty() itemDescription!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() revenueAmount!: number;
}

export class ImportedTimeSeriesBucketResponse {
  @ApiProperty({ enum: [SOURCE] })
  source: ImportedSource = SOURCE;

  @ApiProperty() bucket!: string;
  @ApiProperty() revenueAmount!: number;
  @ApiProperty() saleCount!: number;
}

export class ImportedPaymentMethodResponse {
  @ApiProperty({ enum: [SOURCE] })
  source: ImportedSource = SOURCE;

  @ApiProperty() method!: string;
  @ApiProperty() amount!: number;
}
