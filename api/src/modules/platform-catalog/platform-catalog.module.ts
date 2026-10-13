import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';

import { CATALOG_ITEM_READER } from './domain/repositories/catalog-item.reader';
import { CATALOG_ITEM_REPOSITORY } from './domain/repositories/catalog-item.repository';
import { CATALOG_TAXONOMY_READER } from './domain/repositories/catalog-taxonomy.reader';
import { CATALOG_BROWSE_READER } from './domain/repositories/catalog-browse.reader';

import { PrismaCatalogItemReader } from './infrastructure/persistence/prisma-catalog-item.reader';
import { PrismaCatalogItemRepository } from './infrastructure/persistence/prisma-catalog-item.repository';
import { PrismaCatalogTaxonomyReader } from './infrastructure/persistence/prisma-catalog-taxonomy.reader';
import { PrismaCatalogBrowseReader } from './infrastructure/persistence/prisma-catalog-browse.reader';

import { CatalogResolutionService } from './application/services/catalog-resolution.service';
import { CreateCatalogItemUseCase } from './application/commands/create-catalog-item.usecase';
import { UpdateCatalogItemUseCase } from './application/commands/update-catalog-item.usecase';
import { ArchiveCatalogItemUseCase } from './application/commands/archive-catalog-item.usecase';
import { ImportCatalogItemsUseCase } from './application/commands/import-catalog-items.usecase';
import { GetCatalogItemUseCase } from './application/queries/get-catalog-item.usecase';
import { ListCatalogItemsUseCase } from './application/queries/list-catalog-items.usecase';
import { GetCatalogTaxonomyUseCase } from './application/queries/get-catalog-taxonomy.usecase';
import { BrowseCatalogItemsUseCase } from './application/queries/browse-catalog-items.usecase';
import { GetCatalogBrowseItemUseCase } from './application/queries/get-catalog-browse-item.usecase';

/**
 * Platform catalog (CATALOG-1 read/resolution + CATALOG-2 curation). Owns the
 * platform-curated stock-item catalog + category taxonomy, the by-reference
 * resolution path (ADR §3), and the CRUD use-cases the platform-admin controllers
 * (in PlatformModule) consume. Touches CatalogItem + taxonomy only — never tenant
 * inventory (ADR §4). Distinct from the `catalog` export/import module.
 *
 * IdentityModule is imported for ID_GENERATOR (cuid2 runtime ids on create).
 */
@Module({
  imports: [IdentityModule],
  providers: [
    CatalogResolutionService,
    CreateCatalogItemUseCase,
    UpdateCatalogItemUseCase,
    ArchiveCatalogItemUseCase,
    ImportCatalogItemsUseCase,
    GetCatalogItemUseCase,
    ListCatalogItemsUseCase,
    GetCatalogTaxonomyUseCase,
    BrowseCatalogItemsUseCase,
    GetCatalogBrowseItemUseCase,
    { provide: CATALOG_ITEM_READER, useClass: PrismaCatalogItemReader },
    { provide: CATALOG_ITEM_REPOSITORY, useClass: PrismaCatalogItemRepository },
    { provide: CATALOG_TAXONOMY_READER, useClass: PrismaCatalogTaxonomyReader },
    { provide: CATALOG_BROWSE_READER, useClass: PrismaCatalogBrowseReader },
  ],
  exports: [
    CatalogResolutionService,
    CATALOG_ITEM_READER,
    // Consumed by the platform-admin catalog controllers (PlatformModule).
    CreateCatalogItemUseCase,
    UpdateCatalogItemUseCase,
    ArchiveCatalogItemUseCase,
    ImportCatalogItemsUseCase,
    GetCatalogItemUseCase,
    ListCatalogItemsUseCase,
    GetCatalogTaxonomyUseCase,
    // Consumed by the tenant-facing browse controller + adopt use-case (inventory).
    BrowseCatalogItemsUseCase,
    GetCatalogBrowseItemUseCase,
    CATALOG_BROWSE_READER,
  ],
})
export class PlatformCatalogModule {}
