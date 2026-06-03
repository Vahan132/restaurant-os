import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Paginated } from '../../../../shared/application/pagination';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { ListAuditLogsQuery } from '../../application/dto/list-audit-logs.query';
import { AuditLogResponse } from '../../application/dto/responses';
import { ListAuditLogsUseCase } from '../../application/queries/list-audit-logs.usecase';

@ApiTags('audit')
@ApiBearerAuth('access-token')
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly listLogs: ListAuditLogsUseCase) {}

  @Get()
  @RequirePermissions(PERMISSIONS.AUDIT_VIEW)
  @ApiForbiddenResponse({ description: 'Missing AUDIT_VIEW permission.' })
  @ApiOperation({ summary: 'List audit logs (tenant-scoped; newest first; filters).' })
  @ApiOkResponse({ type: [AuditLogResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListAuditLogsQuery,
  ): Promise<Paginated<AuditLogResponse>> {
    const page = await this.listLogs.execute({
      restaurantId: tenant.restaurantId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      action: query.action,
      entityType: query.entityType,
      entityId: query.entityId,
      actorId: query.actorId,
      page: query.page,
      limit: query.limit,
    });
    return { data: page.data.map(AuditLogResponse.from), pagination: page.pagination };
  }
}
