import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../../../shared/application/pagination';
import { LowStockAlertStatus, NegativeStockMode } from '../../domain/enums';

export class CreateInventoryLocationDto {
  @ApiProperty({ description: 'Location (shelf) name, unique within the branch.' })
  @IsString()
  @MinLength(1)
  name!: string;
}

export class UpdateInventoryLocationDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;
}

export class SetCountedOnHandDto {
  @ApiProperty({ description: 'Inventory item id (must belong to your restaurant + branch).' })
  @IsString()
  @MinLength(1)
  itemId!: string;

  @ApiProperty({ description: 'Location id where the count was taken.' })
  @IsString()
  @MinLength(1)
  locationId!: string;

  @ApiProperty({ description: 'Base unit (e.g. "GRAM") or a defined alternate name (e.g. "kg").' })
  @IsString()
  @MinLength(1)
  unit!: string;

  @ApiProperty({ description: 'The ACTUAL counted quantity in the entered unit (>= 0).', minimum: 0 })
  @IsInt()
  @Min(0)
  countedQty!: number;

  @ApiPropertyOptional({ description: 'Optional reason / note for the correction.' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateBranchPolicyDto {
  @ApiProperty({ enum: NegativeStockMode, description: 'Negative-stock behavior for this branch.' })
  @IsEnum(NegativeStockMode)
  negativeStockMode!: NegativeStockMode;
}

export class ListLowStockAlertsQuery {
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

  @ApiPropertyOptional({ enum: LowStockAlertStatus, description: 'Filter by alert status.' })
  @IsOptional()
  @IsEnum(LowStockAlertStatus)
  status?: LowStockAlertStatus;
}
