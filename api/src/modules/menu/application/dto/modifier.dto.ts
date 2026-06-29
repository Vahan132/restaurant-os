import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../../../shared/application/pagination';
import { MenuStatus, ModifierSelectionType } from '../../domain/enums';

export class CreateModifierGroupDto {
  @ApiProperty({ example: 'Size' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ enum: ModifierSelectionType })
  @IsEnum(ModifierSelectionType)
  selectionType!: ModifierSelectionType;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minSelect?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxSelect?: number;
}

export class UpdateModifierGroupDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ enum: ModifierSelectionType })
  @IsOptional()
  @IsEnum(ModifierSelectionType)
  selectionType?: ModifierSelectionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minSelect?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxSelect?: number;

  @ApiPropertyOptional({ enum: MenuStatus, description: 'Archive a group with INACTIVE.' })
  @IsOptional()
  @IsEnum(MenuStatus)
  status?: MenuStatus;
}

export class ListModifierGroupsQuery {
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
  limit: number = DEFAULT_LIMIT;

  @ApiPropertyOptional({ enum: MenuStatus })
  @IsOptional()
  @IsEnum(MenuStatus)
  status?: MenuStatus;

  @ApiPropertyOptional({ description: 'Case-insensitive name search.' })
  @IsOptional()
  @IsString()
  q?: string;
}

export class CreateModifierOptionDto {
  @ApiProperty({ example: 'Large' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({
    default: 0,
    description: 'Price delta in minor units. May be 0 or negative (a discount).',
  })
  @IsOptional()
  @IsInt()
  priceDeltaAmount?: number;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: false, description: 'Pre-selected option.' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateModifierOptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ description: 'Price delta in minor units. May be 0 or negative.' })
  @IsOptional()
  @IsInt()
  priceDeltaAmount?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ enum: MenuStatus })
  @IsOptional()
  @IsEnum(MenuStatus)
  status?: MenuStatus;
}

export class ReorderModifierOptionsDto {
  @ApiProperty({ type: [String], description: 'Option ids in the desired order.' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  optionIds!: string[];
}
