import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { IdentityModule } from '../identity/identity.module';
import { CatalogCloneService } from './application/services/catalog-clone.service';
import { CatalogExportService } from './application/services/catalog-export.service';
import { CatalogImportService } from './application/services/catalog-import.service';
import { CatalogWorkbookService } from './application/services/catalog-workbook.service';
import { CatalogController } from './presentation/http/catalog.controller';

/**
 * Catalog (BR-6) — import/export of a branch's menu + inventory catalog and
 * in-app branch clone. Orchestrates reads/writes over the menu + inventory tables
 * via PrismaService using stable keys; never touches operational data.
 *
 * Imports IdentityModule for the BRANCH_ACCESS_RESOLVER (used to validate access
 * to a clone SOURCE branch, possibly in another restaurant).
 */
@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [CatalogController],
  providers: [
    CatalogExportService,
    CatalogImportService,
    CatalogCloneService,
    CatalogWorkbookService,
  ],
})
export class CatalogModule {}
