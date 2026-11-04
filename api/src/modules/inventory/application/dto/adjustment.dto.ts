import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../../../shared/application/pagination';
import { AdjustmentDirection, AdjustmentReason } from '../../domain/enums';

export class CreateAdjustmentDto {
  @ApiProperty({ description: 'Inventory item id (must belong to your restaurant).' })
  @IsString()
  @MinLength(1)
  itemId!: string;

  @ApiProperty({ enum: AdjustmentDirection })
  @IsEnum(AdjustmentDirection)
  direction!: AdjustmentDirection;

  @ApiProperty({ description: 'Base unit (e.g. "GRAM") or a defined alternate name (e.g. "kg").' })
  @IsString()
  @MinLength(1)
  unit!: string;

  @ApiProperty({ description: 'Quantity in the entered unit (positive integer).', minimum: 1 })
  @IsInt()
  @Min(1)
  qty!: number;

  @ApiProperty({ enum: AdjustmentReason })
  @IsEnum(AdjustmentReason)
  reason!: AdjustmentReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class ListAdjustmentsQuery {
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
