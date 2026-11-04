import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Paginated } from '../../../../shared/application/pagination';
import { BranchScoped } from '../../../../shared/auth/branch-scoped.decorator';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { BrowseCatalogItemsUseCase } from '../../../platform-catalog/application/queries/browse-catalog-items.usecase';
import { GetCatalogBrowseItemUseCase } from '../../../platform-catalog/application/queries/get-catalog-browse-item.usecase';
import { GetCatalogTaxonomyUseCase } from '../../../platform-catalog/application/queries/get-catalog-taxonomy.usecase';
import {
  BrowseCatalogItemsQuery,
  CatalogBrowseCategoryOptionResponse,
  CatalogBrowseItemResponse,
} from '../../application/dto/catalog-browse.dto';

const READ = PERMISSIONS.INVENTORY_READ;

/**
 * Tenant-facing browse of the platform catalog (CATALOG-1). Read-only window onto
 * global catalog reference data — the adopt action lives on the inventory-items
 * controller. Guarded by the tenant JWT + branch context + inventory:read.
 */
@ApiTags('catalog-browse')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('catalog/items')
export class CatalogBrowseController {
  constructor(
    private readonly browseItems: BrowseCatalogItemsUseCase,
    private readonly getItem: GetCatalogBrowseItemUseCase,
    private readonly taxonomy: GetCatalogTaxonomyUseCase,
  ) {}

  @Get()
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Browse active catalog items (paged; search slug + trilingual names).' })
  @ApiOkResponse({ type: [CatalogBrowseItemResponse] })
  async list(
    @Query() query: BrowseCatalogItemsQuery,
  ): Promise<Paginated<CatalogBrowseItemResponse>> {
    const page = await this.browseItems.execute({
      page: query.page,
      limit: query.limit,
      search: query.search,
      categoryId: query.categoryId,
    });
    return { data: page.data.map(CatalogBrowseItemResponse.from), pagination: page.pagination };
  }

  // Declared before ':id' so "categories" is not captured as an id.
  @Get('categories')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Catalog categories (for the browse filter), in display order.' })
  @ApiOkResponse({ type: [CatalogBrowseCategoryOptionResponse] })
  async categories(): Promise<CatalogBrowseCategoryOptionResponse[]> {
    const { categories } = await this.taxonomy.execute();
    return [...categories]
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: c.id,
        slug: c.slug,
        name: { hy: c.labelHy, ru: c.labelRu, en: c.labelEn },
        position: c.position,
      }));
  }

  @Get(':id')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Get one catalog item (any status, incl. archived).' })
  @ApiOkResponse({ type: CatalogBrowseItemResponse })
  async get(@Param('id') id: string): Promise<CatalogBrowseItemResponse> {
    return CatalogBrowseItemResponse.from(await this.getItem.execute({ catalogItemId: id }));
  }
}
