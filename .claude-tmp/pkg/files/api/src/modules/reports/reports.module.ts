import { Module } from '@nestjs/common';
import { REPORTS_QUERY } from './application/ports/reports-query.port';
import { GetDashboardUseCase } from './application/queries/get-dashboard.usecase';
import { GetSalesSummaryUseCase } from './application/queries/get-sales-summary.usecase';
import { GetSalesTimeSeriesUseCase } from './application/queries/get-sales-timeseries.usecase';
import { GetBranchPaymentMethodsUseCase } from './application/queries/get-branch-payment-methods.usecase';
import { GetSalesByPaymentMethodUseCase } from './application/queries/get-sales-by-payment-method.usecase';
import { GetSalesByWaiterUseCase } from './application/queries/get-sales-by-waiter.usecase';
import { GetSalesByTableUseCase } from './application/queries/get-sales-by-table.usecase';
import { GetSalesByItemUseCase } from './application/queries/get-sales-by-item.usecase';
import { GetDiscountsReportUseCase } from './application/queries/get-discounts-report.usecase';
import { GetCancellationsReportUseCase } from './application/queries/get-cancellations-report.usecase';
import { PrismaReportsQueryService } from './infrastructure/prisma-reports-query.service';
import { ProfitReportService } from './infrastructure/profit-report.service';
import { ReportExportController } from './presentation/http/report-export.controller';
import { PosReportsController } from './presentation/http/pos-reports.controller';
import { ReportsController } from './presentation/http/reports.controller';

/**
 * Reports module — READ side only (CQRS query model). No domain/aggregate: the
 * infrastructure query service uses PrismaService directly (allowed for reads).
 * All figures computed on-the-fly from CLOSED orders; bucketed in restaurant tz.
 */
@Module({
  controllers: [ReportsController, PosReportsController, ReportExportController],
  providers: [
    GetDashboardUseCase,
    GetSalesSummaryUseCase,
    GetSalesTimeSeriesUseCase,
    GetSalesByPaymentMethodUseCase,
    GetBranchPaymentMethodsUseCase,
    GetSalesByWaiterUseCase,
    GetSalesByTableUseCase,
    GetSalesByItemUseCase,
    GetDiscountsReportUseCase,
    GetCancellationsReportUseCase,
    ProfitReportService,
    { provide: REPORTS_QUERY, useClass: PrismaReportsQueryService },
  ],
})
export class ReportsModule {}
