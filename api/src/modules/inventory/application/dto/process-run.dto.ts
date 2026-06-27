import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
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

/** Per-output expiry date for run output (applied only if the item tracks expiry). */
export class OutputExpiryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  itemId!: string;

  @ApiProperty()
  @IsDateString()
  expiryDate!: string;
}

export class RunProcessDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, description: 'Scales every input/output qty.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  multiplier?: number;

  @ApiPropertyOptional({ description: 'When the run occurred (defaults to now).' })
  @IsOptional()
  @IsDateString()
  runAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ type: [OutputExpiryDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OutputExpiryDto)
  outputExpiry?: OutputExpiryDto[];
}

export class ListProcessRunsQuery {
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
  processId?: string;

  @ApiPropertyOptional({ description: 'Runs on/after this date.' })
  @IsOptional()
  @IsDateString()
  runFrom?: string;

  @ApiPropertyOptional({ description: 'Runs on/before this date.' })
  @IsOptional()
  @IsDateString()
  runTo?: string;
}
