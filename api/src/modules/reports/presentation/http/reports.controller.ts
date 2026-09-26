import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { ReportBranchScopeService } from '../../application/report-branch-scope.service';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { DateRangeQuery, TimeSeriesQuery } from '../../application/dto/queries';
import {
  CancellationsResponse,
  DashboardResponse,
  DiscountsResponse,
  ItemRowResponse,
  PaymentMethodResponse,
  ReportBranchResponse,
  SalesSummaryResponse,
  TableRowResponse,
  TimeSeriesBucketResponse,
  WaiterRowResponse,
} from '../../application/dto/responses';
import { GetCancellationsReportUseCase } from '../../application/queries/get-cancellations-report.usecase';
import { GetDashboardUseCase } from '../../application/queries/get-dashboard.usecase';
import { GetDiscountsReportUseCase } from '../../application/queries/get-discounts-report.usecase';
import { GetSalesByItemUseCase } from '../../application/queries/get-sales-by-item.usecase';
import { GetSalesByPaymentMethodUseCase } from '../../application/queries/get-sales-by-payment-method.usecase';
import { GetSalesByTableUseCase } from '../../application/queries/get-sales-by-table.usecase';
import { GetSalesByWaiterUseCase } from '../../application/queries/get-sales-by-waiter.usecase';
import { GetSalesSummaryUseCase } from '../../application/queries/get-sales-summary.usecase';
import { GetSalesTimeSeriesUseCase } from '../../application/queries/get-sales-timeseries.usecase';

const P = PERMISSIONS;

@ApiTags('reports')
@ApiBearerAuth('access-token')
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly dashboard: GetDashboardUseCase,
    private readonly salesSummary: GetSalesSummaryUseCase,
    private readonly timeseries: GetSalesTimeSeriesUseCase,
    private readonly byPaymentMethod: GetSalesByPaymentMethodUseCase,
    private readonly byWaiter: GetSalesByWaiterUseCase,
    private readonly byTable: GetSalesByTableUseCase,
    private readonly byItem: GetSalesByItemUseCase,
    private readonly discountsReport: GetDiscountsReportUseCase,
    private readonly cancellationsReport: GetCancellationsReportUseCase,
    private readonly branchScope: ReportBranchScopeService,
  ) {}

  /** BR-REPORTS-1: access-checked branch ids for a report request. */
  private async branchIds(
    tenant: TenantContext,
    user: CurrentUserContext,
    branchId: string | undefined,
  ): Promise<string[]> {
    const scope = await this.branchScope.resolve({
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
      userId: user.sub,
      requestedBranchId: branchId ?? null,
      permission: P.REPORTS_VIEW,
    });
    return scope.branchIds;
  }

  @Get('branches')
  @RequirePermissions(P.REPORTS_VIEW)
  @ApiForbiddenResponse({ description: 'Missing REPORTS_VIEW permission.' })
  @ApiOperation({
    summary:
      'Branches the caller may filter reports by (owner: every branch; others: branches ' +
      'where they hold reports:view).',
  })
  @ApiOkResponse({ type: [ReportBranchResponse] })
  async getBranches(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
  ): Promise<ReportBranchResponse[]> {
    const base = {
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
      userId: user.sub,
    };
    const view = await this.branchScope.resolve({ ...base, permission: P.REPORTS_VIEW });
    const profit = await this.branchScope
      .resolve({ ...base, permission: P.REPORTS_PROFIT_VIEW })
      .then((s) => new Set(s.branchIds))
      .catch(() => new Set<string>());
    return view.branchIds.map((id) => ({
      id,
      name: view.branchNames.get(id) ?? id,
      canViewProfit: profit.has(id),
    }));
  }

  @Get('dashboard')
  @RequirePermissions(P.DASHBOARD_VIEW)
  @ApiForbiddenResponse({ description: 'Missing DASHBOARD_VIEW permission.' })
  @ApiOperation({ summary: "Today's operational snapshot (restaurant tz)." })
  @ApiOkResponse({ type: DashboardResponse })
  getDashboard(@CurrentTenant() tenant: TenantContext): Promise<DashboardResponse> {
    return this.dashboard.execute({ restaurantId: tenant.restaurantId });
  }

  @Get('sales/summary')
  @RequirePermissions(P.REPORTS_VIEW)
  @ApiForbiddenResponse({ description: 'Missing REPORTS_VIEW permission.' })
  @ApiOperation({ summary: 'Sales summary for a date range (CLOSED orders).' })
  @ApiOkResponse({ type: SalesSummaryResponse })
  async getSummary(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Query() q: DateRangeQuery,
  ): Promise<SalesSummaryResponse> {
    const branchIds = await this.branchIds(tenant, user, q.branchId);
    return this.salesSummary.execute({
      restaurantId: tenant.restaurantId,
      from: q.from,
      to: q.to,
      branchIds,
    });
  }

  @Get('sales/timeseries')
  @RequirePermissions(P.REPORTS_VIEW)
  @ApiForbiddenResponse({ description: 'Missing REPORTS_VIEW permission.' })
  @ApiOperation({ summary: 'Revenue + order count per bucket (day/week/month, restaurant tz).' })
  @ApiOkResponse({ type: [TimeSeriesBucketResponse] })
  async getTimeSeries(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Query() q: TimeSeriesQuery,
  ): Promise<TimeSeriesBucketResponse[]> {
    const branchIds = await this.branchIds(tenant, user, q.branchId);
    return this.timeseries.execute({
      restaurantId: tenant.restaurantId,
      from: q.from,
      to: q.to,
      groupBy: q.groupBy,
      branchIds,
    });
  }

  @Get('sales/by-payment-method')
  @RequirePermissions(P.REPORTS_VIEW)
  @ApiForbiddenResponse({ description: 'Missing REPORTS_VIEW permission.' })
  @ApiOperation({ summary: 'ACTIVE payment totals by method (orders closed in range).' })
  @ApiOkResponse({ type: [PaymentMethodResponse] })
  async getByPaymentMethod(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Query() q: DateRangeQuery,
  ): Promise<PaymentMethodResponse[]> {
    const branchIds = await this.branchIds(tenant, user, q.branchId);
    return this.byPaymentMethod.execute({
      restaurantId: tenant.restaurantId,
      from: q.from,
      to: q.to,
      branchIds,
    });
  }

  @Get('sales/by-waiter')
  @RequirePermissions(P.REPORTS_VIEW)
  @ApiForbiddenResponse({ description: 'Missing REPORTS_VIEW permission.' })
  @ApiOperation({ summary: 'Revenue + order count by waiter.' })
  @ApiOkResponse({ type: [WaiterRowResponse] })
  async getByWaiter(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Query() q: DateRangeQuery,
  ): Promise<WaiterRowResponse[]> {
    const branchIds = await this.branchIds(tenant, user, q.branchId);
    return this.byWaiter.execute({
      restaurantId: tenant.restaurantId,
      from: q.from,
      to: q.to,
      branchIds,
    });
  }

  @Get('sales/by-table')
  @RequirePermissions(P.REPORTS_VIEW)
  @ApiForbiddenResponse({ description: 'Missing REPORTS_VIEW permission.' })
  @ApiOperation({ summary: 'Revenue + order count by table.' })
  @ApiOkResponse({ type: [TableRowResponse] })
  async getByTable(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Query() q: DateRangeQuery,
  ): Promise<TableRowResponse[]> {
    const branchIds = await this.branchIds(tenant, user, q.branchId);
    return this.byTable.execute({
      restaurantId: tenant.restaurantId,
      from: q.from,
      to: q.to,
      branchIds,
    });
  }

  @Get('sales/by-item')
  @RequirePermissions(P.REPORTS_VIEW)
  @ApiForbiddenResponse({ description: 'Missing REPORTS_VIEW permission.' })
  @ApiOperation({ summary: 'Quantity + revenue by menu item (non-cancelled items).' })
  @ApiOkResponse({ type: [ItemRowResponse] })
  async getByItem(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Query() q: DateRangeQuery,
  ): Promise<ItemRowResponse[]> {
    const branchIds = await this.branchIds(tenant, user, q.branchId);
    return this.byItem.execute({
      restaurantId: tenant.restaurantId,
      from: q.from,
      to: q.to,
      branchIds,
    });
  }

  @Get('discounts')
  @RequirePermissions(P.REPORTS_VIEW)
  @ApiForbiddenResponse({ description: 'Missing REPORTS_VIEW permission.' })
  @ApiOperation({ summary: 'Total discount given + per-order list.' })
  @ApiOkResponse({ type: DiscountsResponse })
  async getDiscounts(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Query() q: DateRangeQuery,
  ): Promise<DiscountsResponse> {
    const branchIds = await this.branchIds(tenant, user, q.branchId);
    return this.discountsReport.execute({
      restaurantId: tenant.restaurantId,
      from: q.from,
      to: q.to,
      branchIds,
    });
  }

  @Get('cancellations')
  @RequirePermissions(P.REPORTS_VIEW)
  @ApiForbiddenResponse({ description: 'Missing REPORTS_VIEW permission.' })
  @ApiOperation({ summary: 'Cancelled orders + cancelled items with reasons/values.' })
  @ApiOkResponse({ type: CancellationsResponse })
  async getCancellations(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Query() q: DateRangeQuery,
  ): Promise<CancellationsResponse> {
    const branchIds = await this.branchIds(tenant, user, q.branchId);
    return this.cancellationsReport.execute({
      restaurantId: tenant.restaurantId,
      from: q.from,
      to: q.to,
      branchIds,
    });
  }
}
