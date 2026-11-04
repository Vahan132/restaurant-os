import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { ImportSalesCsvUseCase } from './application/commands/import-sales-csv.usecase';
import { BRANCH_DIRECTORY_READER } from './application/ports/branch-directory.reader';
import { IMPORTED_SALES_ANALYTICS_READER } from './application/ports/imported-sales-analytics.reader';
import { GetImportBatchUseCase } from './application/queries/get-import-batch.usecase';
import { ListImportBatchesUseCase } from './application/queries/list-import-batches.usecase';
import { CsvParserService } from './application/services/csv-parser.service';
import { ImportedSalesAnalyticsService } from './application/services/imported-sales-analytics.service';
import { SaleRowValidator } from './application/services/sale-row.validator';
import { SALES_IMPORT_REPOSITORY } from './domain/repositories/sales-import.repository';
import { PrismaBranchDirectoryReader } from './infrastructure/persistence/prisma-branch-directory.reader';
import { PrismaImportedSalesAnalyticsReader } from './infrastructure/persistence/prisma-imported-sales-analytics.reader';
import { PrismaSalesImportRepository } from './infrastructure/persistence/prisma-sales-import.repository';
import { SalesImportController } from './presentation/http/sales-import.controller';

/**
 * Sales import module (5A): historical/external sales import for analytics.
 * NON-FISCAL, reports-only — structurally isolated from orders, payments,
 * fiscalization, and inventory. Imports IdentityModule for ID_GENERATOR +
 * BRANCH_ACCESS_RESOLVER (branch isolation on import + read).
 */
@Module({
  imports: [IdentityModule],
  controllers: [SalesImportController],
  providers: [
    ImportSalesCsvUseCase,
    ListImportBatchesUseCase,
    GetImportBatchUseCase,
    ImportedSalesAnalyticsService,
    CsvParserService,
    SaleRowValidator,
    { provide: SALES_IMPORT_REPOSITORY, useClass: PrismaSalesImportRepository },
    { provide: BRANCH_DIRECTORY_READER, useClass: PrismaBranchDirectoryReader },
    { provide: IMPORTED_SALES_ANALYTICS_READER, useClass: PrismaImportedSalesAnalyticsReader },
  ],
})
export class SalesImportModule {}
