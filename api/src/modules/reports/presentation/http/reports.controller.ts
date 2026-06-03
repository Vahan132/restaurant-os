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
import { TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { DateRangeQuery, TimeSeriesQuery } from '../../application/dto/queries';
import {
  CancellationsResponse,
  DashboardResponse,
  DiscountsResponse,
  ItemRowResponse,
  PaymentMethodResponse,
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
  ) {}

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
  getSummary(
    @CurrentTenant() tenant: TenantContext,
    @Query() q: DateRangeQuery,
  ): Promise<SalesSummaryResponse> {
    return this.salesSummary.execute({ restaurantId: tenant.restaurantId, from: q.from, to: q.to });
  }

  @Get('sales/timeseries')
  @RequirePermissions(P.REPORTS_VIEW)
  @ApiForbiddenResponse({ description: 'Missing REPORTS_VIEW permission.' })
  @ApiOperation({ summary: 'Revenue + order count per bucket (day/week/month, restaurant tz).' })
  @ApiOkResponse({ type: [TimeSeriesBucketResponse] })
  getTimeSeries(
    @CurrentTenant() tenant: TenantContext,
    @Query() q: TimeSeriesQuery,
  ): Promise<TimeSeriesBucketResponse[]> {
    return this.timeseries.execute({
      restaurantId: tenant.restaurantId,
      from: q.from,
      to: q.to,
      groupBy: q.groupBy,
    });
  }

  @Get('sales/by-payment-method')
  @RequirePermissions(P.REPORTS_VIEW)
  @ApiForbiddenResponse({ description: 'Missing REPORTS_VIEW permission.' })
  @ApiOperation({ summary: 'ACTIVE payment totals by method (orders closed in range).' })
  @ApiOkResponse({ type: [PaymentMethodResponse] })
  getByPaymentMethod(
    @CurrentTenant() tenant: TenantContext,
    @Query() q: DateRangeQuery,
  ): Promise<PaymentMethodResponse[]> {
    return this.byPaymentMethod.execute({
      restaurantId: tenant.restaurantId,
      from: q.from,
      to: q.to,
    });
  }

  @Get('sales/by-waiter')
  @RequirePermissions(P.REPORTS_VIEW)
  @ApiForbiddenResponse({ description: 'Missing REPORTS_VIEW permission.' })
  @ApiOperation({ summary: 'Revenue + order count by waiter.' })
  @ApiOkResponse({ type: [WaiterRowResponse] })
  getByWaiter(
    @CurrentTenant() tenant: TenantContext,
    @Query() q: DateRangeQuery,
  ): Promise<WaiterRowResponse[]> {
    return this.byWaiter.execute({ restaurantId: tenant.restaurantId, from: q.from, to: q.to });
  }

  @Get('sales/by-table')
  @RequirePermissions(P.REPORTS_VIEW)
  @ApiForbiddenResponse({ description: 'Missing REPORTS_VIEW permission.' })
  @ApiOperation({ summary: 'Revenue + order count by table.' })
  @ApiOkResponse({ type: [TableRowResponse] })
  getByTable(
    @CurrentTenant() tenant: TenantContext,
    @Query() q: DateRangeQuery,
  ): Promise<TableRowResponse[]> {
    return this.byTable.execute({ restaurantId: tenant.restaurantId, from: q.from, to: q.to });
  }

  @Get('sales/by-item')
  @RequirePermissions(P.REPORTS_VIEW)
  @ApiForbiddenResponse({ description: 'Missing REPORTS_VIEW permission.' })
  @ApiOperation({ summary: 'Quantity + revenue by menu item (non-cancelled items).' })
  @ApiOkResponse({ type: [ItemRowResponse] })
  getByItem(
    @CurrentTenant() tenant: TenantContext,
    @Query() q: DateRangeQuery,
  ): Promise<ItemRowResponse[]> {
    return this.byItem.execute({ restaurantId: tenant.restaurantId, from: q.from, to: q.to });
  }

  @Get('discounts')
  @RequirePermissions(P.REPORTS_VIEW)
  @ApiForbiddenResponse({ description: 'Missing REPORTS_VIEW permission.' })
  @ApiOperation({ summary: 'Total discount given + per-order list.' })
  @ApiOkResponse({ type: DiscountsResponse })
  getDiscounts(
    @CurrentTenant() tenant: TenantContext,
    @Query() q: DateRangeQuery,
  ): Promise<DiscountsResponse> {
    return this.discountsReport.execute({
      restaurantId: tenant.restaurantId,
      from: q.from,
      to: q.to,
    });
  }

  @Get('cancellations')
  @RequirePermissions(P.REPORTS_VIEW)
  @ApiForbiddenResponse({ description: 'Missing REPORTS_VIEW permission.' })
  @ApiOperation({ summary: 'Cancelled orders + cancelled items with reasons/values.' })
  @ApiOkResponse({ type: CancellationsResponse })
  getCancellations(
    @CurrentTenant() tenant: TenantContext,
    @Query() q: DateRangeQuery,
  ): Promise<CancellationsResponse> {
    return this.cancellationsReport.execute({
      restaurantId: tenant.restaurantId,
      from: q.from,
      to: q.to,
    });
  }
}
