import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../../../shared/application/pagination';
import { InventoryBaseUnit, ItemKind } from '../../domain/enums';

/** An alternate / purchase unit and its integer conversion to the base unit. */
export class AlternateUnitDto {
  @ApiProperty({ description: 'Unit name, e.g. "kg", "L", "box".' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ description: 'Base units per one of this unit (e.g. kg -> 1000).', minimum: 1 })
  @IsInt()
  @Min(1)
  factor!: number;
}

export class CreateInventoryItemDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ enum: InventoryBaseUnit, description: 'Canonical base unit (integer-valued).' })
  @IsEnum(InventoryBaseUnit)
  baseUnit!: InventoryBaseUnit;

  @ApiPropertyOptional({ enum: ItemKind, default: ItemKind.RAW })
  @IsOptional()
  @IsEnum(ItemKind)
  kind?: ItemKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ type: [AlternateUnitDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AlternateUnitDto)
  alternateUnits?: AlternateUnitDto[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  trackExpiry?: boolean;

  @ApiPropertyOptional({ minimum: 0, description: 'Low-stock threshold in base units.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThresholdBase?: number;
}

export class UpdateInventoryItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ enum: ItemKind })
  @IsOptional()
  @IsEnum(ItemKind)
  kind?: ItemKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ type: [AlternateUnitDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AlternateUnitDto)
  alternateUnits?: AlternateUnitDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  trackExpiry?: boolean;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThresholdBase?: number;
}

export class ListInventoryItemsQuery {
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
  categoryId?: string;

  @ApiPropertyOptional({ enum: ItemKind })
  @IsOptional()
  @IsEnum(ItemKind)
  kind?: ItemKind;

  @ApiPropertyOptional({ description: 'Search by name (case-insensitive).' })
  @IsOptional()
  @IsString()
  search?: string;
}

/** 6C: reassign an item's consumption location (omit/empty to reset to default). */
export class SetItemConsumptionLocationDto {
  @ApiPropertyOptional({
    description: 'Target location id; omit or null to reset to the branch default (Main Storage).',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  locationId?: string | null;
}
