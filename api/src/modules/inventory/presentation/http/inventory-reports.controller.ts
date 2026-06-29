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
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import {
  LowStockReportQuery,
  MovementHistoryQuery,
  NegativeStockReportQuery,
  StockOnHandReportQuery,
  ValuationReportQuery,
} from '../../application/dto/report-query.dto';
import {
  StockOnHandRowResponse,
  ValuationSummaryResponse,
} from '../../application/dto/report-responses';
import { StockMovementResponse } from '../../application/dto/responses';
import { GetMovementHistoryUseCase } from '../../application/queries/get-movement-history.usecase';
import {
  GetLowStockReportUseCase,
  GetNegativeStockReportUseCase,
  GetStockOnHandReportUseCase,
  GetValuationSummaryUseCase,
} from '../../application/queries/stock-reports.usecase';

const READ = PERMISSIONS.INVENTORY_READ;

/**
 * Inventory stock REPORTS (6D). Read-only. NOT @BranchScoped — branch isolation
 * is resolved per request from the caller's reach (Owner all-branch callers get
 * cross-branch roll-ups; everyone else is limited to their accessible branches).
 */
@ApiTags('inventory-reports')
@ApiBearerAuth('access-token')
@Controller('inventory/reports')
export class InventoryReportsController {
  constructor(
    private readonly stockOnHand: GetStockOnHandReportUseCase,
    private readonly valuation: GetValuationSummaryUseCase,
    private readonly lowStock: GetLowStockReportUseCase,
    private readonly negativeStock: GetNegativeStockReportUseCase,
    private readonly movements: GetMovementHistoryUseCase,
  ) {}

  @Get('stock-on-hand')
  @RequirePermissions(READ)
  @ApiForbiddenResponse({ description: 'Missing inventory:read, or branch out of scope.' })
  @ApiOperation({ summary: 'Per-(item, location) on-hand + FIFO value (paginated, roll-up totals).' })
  @ApiOkResponse({ type: [StockOnHandRowResponse] })
  async getStockOnHand(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Query() q: StockOnHandReportQuery,
  ): Promise<Paginated<StockOnHandRowResponse> & { totalValuation_amount: number }> {
    const result = await this.stockOnHand.execute({
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
      userId: user.sub,
      branchId: q.branchId,
      locationId: q.locationId,
      itemId: q.itemId,
      categoryId: q.categoryId,
      lowStock: q.lowStock === 'true',
      page: q.page,
      limit: q.limit,
    });
    return {
      data: result.data.map(StockOnHandRowResponse.from),
      pagination: result.pagination,
      totalValuation_amount: result.totalValuationAmount,
    };
  }

  @Get('valuation')
  @RequirePermissions(READ)
  @ApiForbiddenResponse({ description: 'Missing inventory:read, or branch out of scope.' })
  @ApiOperation({ summary: 'Inventory valuation roll-ups: per location, per branch, aggregate.' })
  @ApiOkResponse({ type: ValuationSummaryResponse })
  async getValuation(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Query() q: ValuationReportQuery,
  ): Promise<ValuationSummaryResponse> {
    const summary = await this.valuation.execute({
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
      userId: user.sub,
      branchId: q.branchId,
      locationId: q.locationId,
      itemId: q.itemId,
      categoryId: q.categoryId,
    });
    return ValuationSummaryResponse.from(summary);
  }

  @Get('low-stock')
  @RequirePermissions(READ)
  @ApiForbiddenResponse({ description: 'Missing inventory:read, or branch out of scope.' })
  @ApiOperation({ summary: 'Items at/below their low-stock threshold per (item, location).' })
  @ApiOkResponse({ type: [StockOnHandRowResponse] })
  async getLowStock(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Query() q: LowStockReportQuery,
  ): Promise<StockOnHandRowResponse[]> {
    const rows = await this.lowStock.execute({
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
      userId: user.sub,
      branchId: q.branchId,
      locationId: q.locationId,
      itemId: q.itemId,
      categoryId: q.categoryId,
    });
    return rows.map(StockOnHandRowResponse.from);
  }

  @Get('negative-stock')
  @RequirePermissions(READ)
  @ApiForbiddenResponse({ description: 'Missing inventory:read, or branch out of scope.' })
  @ApiOperation({ summary: 'Items currently negative at a location (correction worklist).' })
  @ApiOkResponse({ type: [StockOnHandRowResponse] })
  async getNegativeStock(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Query() q: NegativeStockReportQuery,
  ): Promise<StockOnHandRowResponse[]> {
    const rows = await this.negativeStock.execute({
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
      userId: user.sub,
      branchId: q.branchId,
      locationId: q.locationId,
      itemId: q.itemId,
      categoryId: q.categoryId,
    });
    return rows.map(StockOnHandRowResponse.from);
  }

  @Get('movements')
  @RequirePermissions(READ)
  @ApiForbiddenResponse({ description: 'Missing inventory:read, or branch out of scope.' })
  @ApiOperation({
    summary: 'Movement-history ledger filtered by item/location/branch/type/date (AND).',
  })
  @ApiOkResponse({ type: [StockMovementResponse] })
  async getMovements(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Query() q: MovementHistoryQuery,
  ): Promise<Paginated<StockMovementResponse>> {
    const page = await this.movements.execute({
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
      userId: user.sub,
      branchId: q.branchId,
      itemId: q.itemId,
      locationId: q.locationId,
      type: q.type,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      page: q.page,
      limit: q.limit,
    });
    return { data: page.data.map(StockMovementResponse.from), pagination: page.pagination };
  }
}
