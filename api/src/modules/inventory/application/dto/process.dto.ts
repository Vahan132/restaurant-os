import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../../../shared/application/pagination';

export class ProcessInputDto {
  @ApiProperty({ description: 'Inventory item id (RAW or PROCESSED).' })
  @IsString()
  @MinLength(1)
  itemId!: string;

  @ApiProperty({ description: 'Quantity in the item base unit consumed per 1× batch.', minimum: 1 })
  @IsInt()
  @Min(1)
  baseQty!: number;
}

export class ProcessOutputDto {
  @ApiProperty({ description: 'Output item id (MUST be of kind PROCESSED).' })
  @IsString()
  @MinLength(1)
  itemId!: string;

  @ApiProperty({ description: 'Quantity produced per 1× batch (base unit).', minimum: 1 })
  @IsInt()
  @Min(1)
  baseQty!: number;

  @ApiPropertyOptional({ default: false, description: 'Absorbs 100% of cost when no shares set.' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 10000, description: 'Cost share in basis points.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  costShareBps?: number;
}

export class CreateProcessDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ minimum: 0, description: 'Per-run processing cost in minor units.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  processingCost_amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ type: [ProcessInputDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ProcessInputDto)
  inputs!: ProcessInputDto[];

  @ApiProperty({ type: [ProcessOutputDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ProcessOutputDto)
  outputs!: ProcessOutputDto[];
}

export class UpdateProcessDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  processingCost_amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ type: [ProcessInputDto], description: 'Full replacement of inputs.' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ProcessInputDto)
  inputs?: ProcessInputDto[];

  @ApiPropertyOptional({ type: [ProcessOutputDto], description: 'Full replacement of outputs.' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ProcessOutputDto)
  outputs?: ProcessOutputDto[];
}

export class ListProcessesQuery {
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

  @ApiPropertyOptional({ description: 'Search by process name (case-insensitive).' })
  @IsOptional()
  @IsString()
  search?: string;
}
