import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';
import {
  CatalogCategoryResponse,
  CatalogTaxonomyResponse,
} from '../../../platform-catalog/application/dto/catalog-responses';
import { GetCatalogTaxonomyUseCase } from '../../../platform-catalog/application/queries/get-catalog-taxonomy.usecase';
import { PlatformAuthGuard } from '../platform-auth.guard';

/**
 * Read-only category taxonomy for the catalog curation picker
 * (CATALOG-2-FE). Platform-admin guarded. Global reference data; no tenant scope.
 */
@ApiTags('platform-catalog-taxonomy')
@ApiBearerAuth('platform-token')
@Public()
@UseGuards(PlatformAuthGuard)
@Controller('platform/catalog-taxonomy')
export class PlatformCatalogTaxonomyController {
  constructor(private readonly getTaxonomy: GetCatalogTaxonomyUseCase) {}

  @Get()
  @ApiOperation({ summary: 'List the category taxonomy for the picker.' })
  @ApiOkResponse({ type: CatalogTaxonomyResponse })
  async get(): Promise<CatalogTaxonomyResponse> {
    const { categories } = await this.getTaxonomy.execute();
    return { categories: categories.map(CatalogCategoryResponse.from) };
  }
}
