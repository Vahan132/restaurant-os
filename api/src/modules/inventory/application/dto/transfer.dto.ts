import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../../../shared/application/pagination';

export class CreateTransferDto {
  @ApiProperty({ description: 'Inventory item id (must belong to your restaurant + branch).' })
  @IsString()
  @MinLength(1)
  itemId!: string;

  @ApiProperty({ description: 'Source location id (same branch).' })
  @IsString()
  @MinLength(1)
  fromLocationId!: string;

  @ApiProperty({ description: 'Destination location id (same branch, ≠ source).' })
  @IsString()
  @MinLength(1)
  toLocationId!: string;

  @ApiProperty({ description: 'Base unit (e.g. "GRAM") or a defined alternate name (e.g. "kg").' })
  @IsString()
  @MinLength(1)
  unit!: string;

  @ApiProperty({ description: 'Quantity in the entered unit (positive integer).', minimum: 1 })
  @IsInt()
  @Min(1)
  qty!: number;
}

export class ListTransfersQuery {
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

  @ApiPropertyOptional({ description: 'Filter to a single item.' })
  @IsOptional()
  @IsString()
  itemId?: string;
}
