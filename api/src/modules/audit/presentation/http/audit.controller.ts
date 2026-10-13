import { Controller, Get, Query, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Paginated } from '../../../../shared/application/pagination';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { auditLogsToCsv } from '../../application/audit-csv';
import { AuditFilterRequest } from '../../application/services/audit-query.service';
import { ListAuditLogsQuery } from '../../application/dto/list-audit-logs.query';
import { AuditLogResponse } from '../../application/dto/responses';
import { ExportAuditLogsUseCase } from '../../application/queries/export-audit-logs.usecase';
import { ListAuditLogsUseCase } from '../../application/queries/list-audit-logs.usecase';

@ApiTags('audit')
@ApiBearerAuth('access-token')
@Controller('audit-logs')
export class AuditController {
  constructor(
    private readonly listLogs: ListAuditLogsUseCase,
    private readonly exportLogs: ExportAuditLogsUseCase,
  ) {}

  /** Translate the HTTP query + caller into the shared filter request. */
  private toFilterRequest(
    tenant: TenantContext,
    user: CurrentUserContext,
    query: ListAuditLogsQuery,
  ): AuditFilterRequest {
    return {
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
      userId: user.sub,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      action: query.action,
      role: query.role,
      branchId: query.branchId,
      actorId: query.actorId,
      entityType: query.entityType,
      entityId: query.entityId,
    };
  }

  @Get()
  @RequirePermissions(PERMISSIONS.AUDIT_VIEW)
  @ApiForbiddenResponse({ description: 'Missing AUDIT_VIEW permission, or branch out of scope.' })
  @ApiOperation({ summary: 'List audit logs (branch-scoped; newest first; combinable filters).' })
  @ApiOkResponse({ type: [AuditLogResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Query() query: ListAuditLogsQuery,
  ): Promise<Paginated<AuditLogResponse>> {
    const page = await this.listLogs.execute({
      ...this.toFilterRequest(tenant, user, query),
      page: query.page,
      limit: query.limit,
    });
    return { data: page.data.map(AuditLogResponse.from), pagination: page.pagination };
  }

  @Get('export')
  @RequirePermissions(PERMISSIONS.AUDIT_VIEW)
  @ApiForbiddenResponse({ description: 'Missing AUDIT_VIEW permission, or branch out of scope.' })
  @ApiOperation({
    summary:
      'Export audit logs as CSV (same filters as the list — what you see is what you export).',
  })
  @ApiProduces('text/csv')
  @ApiOkResponse({ description: 'CSV file of the filtered audit logs.' })
  async export(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Query() query: ListAuditLogsQuery,
    @Res() res: Response,
  ): Promise<void> {
    const logs = await this.exportLogs.execute(this.toFilterRequest(tenant, user, query));
    const csv = auditLogsToCsv(logs);
    const filename = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    res
      .status(200)
      .set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      })
      .send(csv);
  }
}
