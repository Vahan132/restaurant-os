import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Paginated } from '../../../../shared/application/pagination';
import { ActiveBranchId } from '../../../../shared/auth/active-branch.decorator';
import { BranchScoped } from '../../../../shared/auth/branch-scoped.decorator';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { ListLowStockAlertsQuery } from '../../application/dto/location.dto';
import { LowStockAlertResponse } from '../../application/dto/location-responses';
import { ListLowStockAlertsUseCase } from '../../application/queries/list-low-stock-alerts.usecase';

@ApiTags('inventory-alerts')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('inventory/alerts/low-stock')
export class LowStockAlertsController {
  constructor(private readonly listAlerts: ListLowStockAlertsUseCase) {}

  @Get()
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  @ApiOperation({ summary: 'List low-stock alerts for the active branch (paginated).' })
  @ApiOkResponse({ type: [LowStockAlertResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Query() query: ListLowStockAlertsQuery,
  ): Promise<Paginated<LowStockAlertResponse>> {
    const page = await this.listAlerts.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      status: query.status,
      page: query.page,
      limit: query.limit,
    });
    return { data: page.data.map(LowStockAlertResponse.from), pagination: page.pagination };
  }
}
