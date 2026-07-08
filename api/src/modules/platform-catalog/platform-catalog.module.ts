import { Module } from '@nestjs/common';
import { CATALOG_ITEM_READER } from './domain/repositories/catalog-item.reader';
import { PrismaCatalogItemReader } from './infrastructure/persistence/prisma-catalog-item.reader';
import { CatalogResolutionService } from './application/services/catalog-resolution.service';

/**
 * Platform catalog (CATALOG-1). Owns the platform-curated stock-item catalog +
 * allergen taxonomy and the reference-with-override RESOLUTION read path (ADR §3).
 *
 * No HTTP surface yet — catalog CRUD is CATALOG-2 (platform-admin), the staff
 * allergen rollup is CATALOG-4. Exports the resolution service + reader token so
 * those prompts (and CATALOG-3's dual-depth traversal) can consume it.
 *
 * Distinct from the existing `catalog` module (spreadsheet export/import tooling).
 * Loads in both CLOUD and EDGE: staff allergen resolution needs it on the hub too.
 */
@Module({
  providers: [
    CatalogResolutionService,
    { provide: CATALOG_ITEM_READER, useClass: PrismaCatalogItemReader },
  ],
  exports: [CatalogResolutionService, CATALOG_ITEM_READER],
})
export class PlatformCatalogModule {}
