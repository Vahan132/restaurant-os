import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ActiveBranchId } from '../../../../shared/auth/active-branch.decorator';
import { BranchScoped } from '../../../../shared/auth/branch-scoped.decorator';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import {
  DailyInventoryReportQuery,
  DailyInventoryReportResponse,
} from '../../application/dto/daily-report.dto';
import { GetDailyInventoryReportUseCase } from '../../application/queries/get-daily-inventory-report.usecase';

/** DAILY-INV-1: end-of-day inventory report for the active branch. */
@ApiTags('inventory-daily-report')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('inventory/daily-report')
export class DailyInventoryReportController {
  constructor(private readonly report: GetDailyInventoryReportUseCase) {}

  @Get()
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  @ApiForbiddenResponse({ description: 'Missing inventory:read.' })
  @ApiOperation({
    summary:
      'End-of-day inventory report: per item opening, received, sold, produced, used, ' +
      "wasted, count variance, adjustments, closing (qty + value) and the day's ingredient " +
      '+ dish cost-price changes. Closed days are served from a frozen nightly snapshot.',
  })
  @ApiOkResponse({ type: DailyInventoryReportResponse })
  async get(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Query() q: DailyInventoryReportQuery,
  ): Promise<DailyInventoryReportResponse> {
    return this.report.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      date: q.date,
      refresh: q.refresh === 'true',
    });
  }
}
