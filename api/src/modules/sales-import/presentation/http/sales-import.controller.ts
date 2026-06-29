import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Paginated } from '../../../../shared/application/pagination';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { NoFileUploaded } from '../../application/application.errors';
import {
  ImportedItemRowResponse,
  ImportedPaymentMethodResponse,
  ImportedSalesSummaryResponse,
  ImportedTimeSeriesBucketResponse,
} from '../../application/dto/analytics.dto';
import { ImportBatchResponse, ImportResultResponse } from '../../application/dto/import.dto';
import {
  ImportedSalesReportQuery,
  ImportedSalesTimeSeriesQuery,
  ListBatchesQuery,
} from '../../application/dto/queries';
import { ImportSalesCsvUseCase } from '../../application/commands/import-sales-csv.usecase';
import { GetImportBatchUseCase } from '../../application/queries/get-import-batch.usecase';
import { ListImportBatchesUseCase } from '../../application/queries/list-import-batches.usecase';
import {
  AnalyticsRequest,
  ImportedSalesAnalyticsService,
} from '../../application/services/imported-sales-analytics.service';

/** Minimal multer file shape (avoids a hard dependency on @types/multer). */
interface UploadedCsvFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

const P = PERMISSIONS;

@ApiTags('sales-import')
@ApiBearerAuth('access-token')
@Controller('sales-import')
export class SalesImportController {
  constructor(
    private readonly importCsv: ImportSalesCsvUseCase,
    private readonly listBatches: ListImportBatchesUseCase,
    private readonly getBatch: GetImportBatchUseCase,
    private readonly analytics: ImportedSalesAnalyticsService,
  ) {}

  // ── Upload ────────────────────────────────────────────────────────────────
  @Post()
  @RequirePermissions(P.SALES_IMPORT_MANAGE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  @ApiOperation({
    summary:
      'Upload a CSV of historical/external sales (NON-FISCAL, reports-only). ' +
      'Tolerant column mapping; per-row validation; per-row success/error summary.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary', description: 'CSV file.' } },
    },
  })
  @ApiCreatedResponse({ type: ImportResultResponse })
  @ApiForbiddenResponse({ description: 'Missing SALES_IMPORT_MANAGE permission.' })
  async upload(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @UploadedFile() file?: UploadedCsvFile,
  ): Promise<ImportResultResponse> {
    if (!file || !file.buffer) {
      throw NoFileUploaded();
    }
    return this.importCsv.execute({
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
      userId: user.sub,
      fileName: file.originalname || 'upload.csv',
      content: file.buffer.toString('utf8'),
    });
  }

  // ── Batches ─────────────────────────────────────────────────────────────────
  @Get('batches')
  @RequirePermissions(P.SALES_IMPORT_MANAGE)
  @ApiOperation({ summary: 'List import batches (branch-scoped; newest first).' })
  @ApiOkResponse({ type: [ImportBatchResponse] })
  @ApiForbiddenResponse({ description: 'Missing SALES_IMPORT_MANAGE permission.' })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Query() query: ListBatchesQuery,
  ): Promise<Paginated<ImportBatchResponse>> {
    const page = await this.listBatches.execute({
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
      userId: user.sub,
      page: query.page,
      limit: query.limit,
    });
    return { data: page.data.map(ImportBatchResponse.from), pagination: page.pagination };
  }

  @Get('batches/:id')
  @RequirePermissions(P.SALES_IMPORT_MANAGE)
  @ApiParam({ name: 'id', description: 'Import batch id.' })
  @ApiOperation({ summary: 'Get one import batch (branch-scoped).' })
  @ApiOkResponse({ type: ImportBatchResponse })
  @ApiForbiddenResponse({ description: 'Missing SALES_IMPORT_MANAGE permission.' })
  async get(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
  ): Promise<ImportBatchResponse> {
    const batch = await this.getBatch.execute({
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
      userId: user.sub,
      id,
    });
    return ImportBatchResponse.from(batch);
  }

  // ── Imported-sales analytics (opt-in, labeled source: IMPORTED) ─────────────
  // These read ONLY imported data. The orders-based fiscal reports never include
  // imported sales under any filter — isolation is structural.
  private req(
    tenant: TenantContext,
    user: CurrentUserContext,
    q: ImportedSalesReportQuery,
  ): AnalyticsRequest {
    return {
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
      userId: user.sub,
      from: q.from,
      to: q.to,
    };
  }

  @Get('analytics/summary')
  @RequirePermissions(P.REPORTS_VIEW)
  @ApiOperation({ summary: 'Imported-sales summary (NON-FISCAL; labeled source=IMPORTED).' })
  @ApiOkResponse({ type: ImportedSalesSummaryResponse })
  @ApiForbiddenResponse({ description: 'Missing REPORTS_VIEW permission.' })
  async summary(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Query() q: ImportedSalesReportQuery,
  ): Promise<ImportedSalesSummaryResponse> {
    const data = await this.analytics.summary(this.req(tenant, user, q));
    return { source: 'IMPORTED' as const, ...data };
  }

  @Get('analytics/by-item')
  @RequirePermissions(P.REPORTS_VIEW)
  @ApiOperation({ summary: 'Imported quantity + revenue by item (labeled source=IMPORTED).' })
  @ApiOkResponse({ type: [ImportedItemRowResponse] })
  @ApiForbiddenResponse({ description: 'Missing REPORTS_VIEW permission.' })
  async byItem(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Query() q: ImportedSalesReportQuery,
  ): Promise<ImportedItemRowResponse[]> {
    const rows = await this.analytics.byItem(this.req(tenant, user, q));
    return rows.map((r) => ({ source: 'IMPORTED' as const, ...r }));
  }

  @Get('analytics/timeseries')
  @RequirePermissions(P.REPORTS_VIEW)
  @ApiOperation({ summary: 'Imported revenue per bucket (day/week/month; source=IMPORTED).' })
  @ApiOkResponse({ type: [ImportedTimeSeriesBucketResponse] })
  @ApiForbiddenResponse({ description: 'Missing REPORTS_VIEW permission.' })
  async timeseries(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Query() q: ImportedSalesTimeSeriesQuery,
  ): Promise<ImportedTimeSeriesBucketResponse[]> {
    const rows = await this.analytics.timeSeries(this.req(tenant, user, q), q.groupBy);
    return rows.map((r) => ({ source: 'IMPORTED' as const, ...r }));
  }

  @Get('analytics/by-payment-method')
  @RequirePermissions(P.REPORTS_VIEW)
  @ApiOperation({ summary: 'Imported totals by payment method (source=IMPORTED).' })
  @ApiOkResponse({ type: [ImportedPaymentMethodResponse] })
  @ApiForbiddenResponse({ description: 'Missing REPORTS_VIEW permission.' })
  async byPaymentMethod(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Query() q: ImportedSalesReportQuery,
  ): Promise<ImportedPaymentMethodResponse[]> {
    const rows = await this.analytics.byPaymentMethod(this.req(tenant, user, q));
    return rows.map((r) => ({ source: 'IMPORTED' as const, ...r }));
  }
}
