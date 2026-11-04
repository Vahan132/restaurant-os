import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../../../shared/application/pagination';
import { SYSTEM_ROLE_CODES } from '../../../identity/domain/permissions.catalog';
import { AUDIT_ACTIONS } from '../../domain/audit-actions.catalog';

/**
 * Combinable filter set for the activity log (AND semantics). Shared by the
 * filtered list view and the CSV export — any subset may be supplied; absent
 * filters are ignored. `forbidNonWhitelisted` rejects unknown query params.
 */
export class ListAuditLogsQuery {
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

  @ApiPropertyOptional({ description: 'From timestamp (ISO 8601, inclusive). Must be <= `to`.' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'To timestamp (ISO 8601, inclusive). Must be >= `from`.' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description: 'Action type filter (validated against recorded actions).',
    enum: [...AUDIT_ACTIONS],
  })
  @IsOptional()
  @IsIn([...AUDIT_ACTIONS])
  action?: string;

  @ApiPropertyOptional({
    description: "Actor's role code filter (system role codes).",
    enum: [...SYSTEM_ROLE_CODES],
  })
  @IsOptional()
  @IsIn([...SYSTEM_ROLE_CODES])
  role?: string;

  @ApiPropertyOptional({ description: 'Branch id filter (within the caller’s reachable scope).' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Actor (employee) id filter.' })
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;
}
