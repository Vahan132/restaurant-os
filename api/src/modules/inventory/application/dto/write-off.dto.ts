import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../../../shared/application/pagination';
import { WriteOffLineKind, WriteOffReason } from '../../domain/enums';

/**
 * A write-off line is a discriminated union on `kind`. Per-kind required fields
 * are validated with @ValidateIf; the whitelist keeps every field declared so
 * forbidNonWhitelisted never rejects a valid line.
 */
export class WriteOffLineDto {
  @ApiProperty({ enum: WriteOffLineKind })
  @IsEnum(WriteOffLineKind)
  kind!: WriteOffLineKind;

  @ApiPropertyOptional({ description: 'ITEM: inventory item id.' })
  @ValidateIf((o) => o.kind === WriteOffLineKind.ITEM)
  @IsString()
  @MinLength(1)
  itemId?: string;

  @ApiPropertyOptional({ description: 'ITEM: base unit or a defined alternate unit name.' })
  @ValidateIf((o) => o.kind === WriteOffLineKind.ITEM)
  @IsString()
  @MinLength(1)
  unit?: string;

  @ApiPropertyOptional({ description: 'ITEM: quantity in the entered unit.', minimum: 1 })
  @ValidateIf((o) => o.kind === WriteOffLineKind.ITEM)
  @IsInt()
  @Min(1)
  qty?: number;

  @ApiPropertyOptional({ description: 'DISH: menu item id whose recipe is exploded.' })
  @ValidateIf((o) => o.kind === WriteOffLineKind.DISH)
  @IsString()
  @MinLength(1)
  menuItemId?: string;

  @ApiPropertyOptional({ description: 'DISH: number of dish units.', minimum: 1 })
  @ValidateIf((o) => o.kind === WriteOffLineKind.DISH)
  @IsInt()
  @Min(1)
  units?: number;

  @ApiPropertyOptional({ type: [String], description: 'DISH: selected modifier option ids.' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  modifierOptionIds?: string[];
}

export class CreateWriteOffDto {
  @ApiProperty({ enum: WriteOffReason })
  @IsEnum(WriteOffReason)
  reason!: WriteOffReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'When the loss occurred (defaults to now).' })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiProperty({ type: [WriteOffLineDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => WriteOffLineDto)
  lines!: WriteOffLineDto[];
}

export class ListWriteOffsQuery {
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

  @ApiPropertyOptional({ enum: WriteOffReason })
  @IsOptional()
  @IsEnum(WriteOffReason)
  reason?: WriteOffReason;

  @ApiPropertyOptional({ enum: WriteOffLineKind })
  @IsOptional()
  @IsEnum(WriteOffLineKind)
  kind?: WriteOffLineKind;

  @ApiPropertyOptional({ description: 'On/after this date.' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'On/before this date.' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class WriteOffSummaryQuery {
  @ApiPropertyOptional({ description: 'On/after this date.' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'On/before this date.' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
