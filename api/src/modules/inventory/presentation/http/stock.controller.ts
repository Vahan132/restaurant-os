import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Paginated } from '../../../../shared/application/pagination';
import { ActiveBranchId } from '../../../../shared/auth/active-branch.decorator';
import { BranchScoped } from '../../../../shared/auth/branch-scoped.decorator';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { StockRowResponse } from '../../application/dto/responses';
import { StockQuery } from '../../application/dto/stock-query.dto';
import { GetStockUseCase } from '../../application/queries/get-stock.usecase';

const READ = PERMISSIONS.INVENTORY_READ;

@ApiTags('inventory-stock')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('inventory/stock')
export class StockController {
  constructor(private readonly getStock: GetStockUseCase) {}

  @Get()
  @RequirePermissions(READ)
  @ApiOperation({
    summary: 'On-hand + valuation per item (lowStock / expiringBefore / kind filters).',
  })
  @ApiOkResponse({ type: [StockRowResponse] })
  async stock(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Query() query: StockQuery,
  ): Promise<Paginated<StockRowResponse>> {
    const page = await this.getStock.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      lowStock: query.lowStock === 'true',
      expiringBefore: query.expiringBefore ? new Date(query.expiringBefore) : undefined,
      categoryId: query.categoryId,
      kind: query.kind,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
    return { data: page.data.map(StockRowResponse.from), pagination: page.pagination };
  }
}
