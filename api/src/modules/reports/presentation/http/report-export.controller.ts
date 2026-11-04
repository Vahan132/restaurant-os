import { Body, Controller, Get, HttpCode, Post, Query, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import {
  currencyDecimals,
  formatReportDate,
  renderReportWorkbook,
  XLSX_CONTENT_TYPE,
} from '../../../../shared/infrastructure/excel/report-workbook';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { ReportBranchScopeService } from '../../application/report-branch-scope.service';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { ExportTableDto, ProfitExportQuery, safeFileName } from '../../application/dto/export.dto';
import { ProfitTotalsResponse } from '../../application/dto/responses';
import {
  buildSalesSheet,
  ProfitReportService,
  ReportLang,
} from '../../infrastructure/profit-report.service';

function sendXlsx(res: Response, buffer: Buffer, fileName: string): void {
  res
    .status(200)
    .set({
      'Content-Type': XLSX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="${fileName}.xlsx"`,
      'Content-Length': String(buffer.length),
    })
    .send(buffer);
}

/**
 * REPORT-XLSX-1 / PROFIT-XLSX-1: Excel exports in the standard back-office layout
 * (title, period, warehouses, grey header row, totals).
 */
@ApiTags('reports')
@ApiBearerAuth('access-token')
@Controller('reports')
export class ReportExportController {
  constructor(
    private readonly profit: ProfitReportService,
    private readonly branchScope: ReportBranchScopeService,
  ) {}

  /** BR-REPORTS-1: access-checked branch filter for an export / profit request. */
  private async branches(
    tenant: TenantContext,
    user: CurrentUserContext,
    branchId: string | undefined,
    permission: string,
  ): Promise<{ ids: string[]; name: string | null }> {
    const scope = await this.branchScope.resolve({
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
      userId: user.sub,
      requestedBranchId: branchId ?? null,
      permission,
    });
    return { ids: scope.branchIds, name: scope.selectedBranchName };
  }

  @Post('export/xlsx')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Render an on-screen report table (already visible to the caller) into the standard ' +
      'Excel layout. Money cells are MAJOR units.',
  })
  @ApiProduces(XLSX_CONTENT_TYPE)
  @ApiOkResponse({ description: 'XLSX workbook.' })
  async exportTable(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Body() dto: ExportTableDto,
    @Res() res: Response,
  ): Promise<void> {
    let sheets = dto.sheets;
    if (tenant.restaurantId && (dto.warehousesLabel || dto.branchId)) {
      // Rendering only: the rows are already on the caller's screen. The branch
      // is still access-checked so the header never names a foreign branch.
      const branch = dto.branchId
        ? await this.branches(tenant, user, dto.branchId, PERMISSIONS.REPORTS_VIEW)
        : null;
      const lines: string[] = [];
      if (branch?.name) {
        lines.push(`${dto.branchLabel || 'Branch'}: ${branch.name}`);
      }
      if (dto.warehousesLabel) {
        const names = await this.profit.locationNames(tenant.restaurantId, branch?.ids);
        lines.push(`${dto.warehousesLabel}: ${names.join(', ') || '—'}`);
      }
      sheets = sheets.map((s) => ({ ...s, infoLines: [...(s.infoLines ?? []), ...lines] }));
    }
    const buffer = await renderReportWorkbook(sheets, { moneyDecimals: dto.moneyDecimals });
    sendXlsx(res, buffer, safeFileName(dto.fileName, 'report'));
  }

  @Get('profit')
  @RequirePermissions(PERMISSIONS.REPORTS_PROFIT_VIEW)
  @ApiForbiddenResponse({ description: 'Missing reports:profit:view permission.' })
  @ApiOperation({
    summary: 'Period P&L: revenue, cost price of sold items, write-offs, expenses, net profit.',
  })
  @ApiOkResponse({ type: ProfitTotalsResponse })
  async getProfit(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Query() q: ProfitExportQuery,
  ): Promise<ProfitTotalsResponse> {
    const branches = await this.branches(tenant, user, q.branchId, PERMISSIONS.REPORTS_PROFIT_VIEW);
    const data = await this.profit.collect(
      tenant.restaurantId,
      q.from,
      q.to,
      q.lang ?? 'ru',
      branches,
    );
    return data.totals;
  }

  @Get('profit/export')
  @RequirePermissions(PERMISSIONS.REPORTS_PROFIT_VIEW)
  @ApiForbiddenResponse({ description: 'Missing reports:profit:view permission.' })
  @ApiOperation({
    summary:
      'Full Excel for a period: profit summary, sales by product with cost price / gross ' +
      'profit / markup, write-offs and expenses.',
  })
  @ApiProduces(XLSX_CONTENT_TYPE)
  @ApiOkResponse({ description: 'XLSX workbook.' })
  async exportProfit(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Query() q: ProfitExportQuery,
    @Res() res: Response,
  ): Promise<void> {
    const lang: ReportLang = q.lang ?? 'ru';
    const branches = await this.branches(tenant, user, q.branchId, PERMISSIONS.REPORTS_PROFIT_VIEW);
    const data = await this.profit.collect(tenant.restaurantId, q.from, q.to, lang, branches);
    const tz = await this.profit.timezone(tenant.restaurantId);
    const buffer = await this.profit.workbook(data, lang, tz);
    sendXlsx(res, buffer, `profit_${q.from}_${q.to}`);
  }

  @Get('sales/by-item/export')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  @ApiForbiddenResponse({ description: 'Missing REPORTS_VIEW permission.' })
  @ApiOperation({ summary: 'Sales by product (with cost price) as Excel.' })
  @ApiProduces(XLSX_CONTENT_TYPE)
  @ApiOkResponse({ description: 'XLSX workbook.' })
  async exportByItem(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Query() q: ProfitExportQuery,
    @Res() res: Response,
  ): Promise<void> {
    const lang: ReportLang = q.lang ?? 'ru';
    const branches = await this.branches(tenant, user, q.branchId, PERMISSIONS.REPORTS_VIEW);
    const data = await this.profit.collect(tenant.restaurantId, q.from, q.to, lang, branches);
    const decimals = currencyDecimals(data.currency);
    const vars = {
      from: formatReportDate(q.from),
      to: formatReportDate(q.to),
      cur: data.currency,
    };
    const sheet = buildSalesSheet(
      data.products,
      lang,
      vars,
      this.profit.infoLines(data, lang),
      (n) => n / 10 ** decimals,
    );
    const buffer = await renderReportWorkbook([sheet], { moneyDecimals: decimals });
    sendXlsx(res, buffer, `sales_${q.from}_${q.to}`);
  }
}
