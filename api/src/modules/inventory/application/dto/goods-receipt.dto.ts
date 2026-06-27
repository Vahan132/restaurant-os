import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../../../shared/application/pagination';

export class GoodsReceiptLineDto {
  @ApiProperty({ description: 'Inventory item id (must belong to your restaurant).' })
  @IsString()
  @MinLength(1)
  itemId!: string;

  @ApiProperty({ description: 'Base unit (e.g. "GRAM") or a defined alternate name (e.g. "kg").' })
  @IsString()
  @MinLength(1)
  unit!: string;

  @ApiProperty({ description: 'Quantity in the entered unit (positive integer).', minimum: 1 })
  @IsInt()
  @Min(1)
  qty!: number;

  // eslint-disable-next-line @typescript-eslint/naming-convention
  @ApiProperty({ description: 'Total paid for this line, in integer minor units.', minimum: 0 })
  @IsInt()
  @Min(0)
  lineTotalCost_amount!: number;

  @ApiPropertyOptional({ description: 'Batch expiry (only when the item tracks expiry).' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}

export class CreateGoodsReceiptDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'When goods were received (defaults to now).' })
  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ type: [GoodsReceiptLineDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => GoodsReceiptLineDto)
  lines!: GoodsReceiptLineDto[];
}

export class ListGoodsReceiptsQuery {
  @ApiPropertyOptional({ default: DEFAULT_PAGE, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = DEFAULT_PAGE;

  @ApiPropertyOptional({ default: DEFAULT_LIMIT, minimum: 1, maximum: MAX_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit: number = DEFAULT_LIMIT;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Filter receipts received on/after this date.' })
  @IsOptional()
  @IsDateString()
  receivedFrom?: string;

  @ApiPropertyOptional({ description: 'Filter receipts received on/before this date.' })
  @IsOptional()
  @IsDateString()
  receivedTo?: string;
}
