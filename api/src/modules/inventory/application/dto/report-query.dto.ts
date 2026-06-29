import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../../../shared/application/pagination';
import { StockMovementType } from '../../domain/enums';

/** Shared narrowing filters for the stock reports (branch reach is enforced server-side). */
class ReportScopeQuery {
  @ApiPropertyOptional({ description: 'Branch filter (within the caller’s reach; omit = all reachable).' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Filter to one location.' })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({ description: 'Filter to one item.' })
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiPropertyOptional({ description: 'Filter to one category.' })
  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class StockOnHandReportQuery extends ReportScopeQuery {
  @ApiPropertyOptional({ description: 'Only rows at/below their low-stock threshold. Pass "true".', enum: ['true', 'false'] })
  @IsOptional()
  @IsIn(['true', 'false'])
  lowStock?: string;

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
}

export class ValuationReportQuery extends ReportScopeQuery {}

export class LowStockReportQuery extends ReportScopeQuery {}

export class NegativeStockReportQuery extends ReportScopeQuery {}

export class MovementHistoryQuery {
  @ApiPropertyOptional({ description: 'Branch filter (within the caller’s reach; omit = all reachable).' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Filter to one item.' })
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiPropertyOptional({ description: 'Filter to one location.' })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({ enum: StockMovementType, description: 'Filter by exact movement type.' })
  @IsOptional()
  @IsEnum(StockMovementType)
  type?: StockMovementType;

  @ApiPropertyOptional({ description: 'From occurredAt (ISO 8601, inclusive).' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'To occurredAt (ISO 8601, inclusive).' })
  @IsOptional()
  @IsDateString()
  to?: string;

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
}
