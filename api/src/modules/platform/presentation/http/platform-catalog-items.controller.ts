import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';
import { Paginated } from '../../../../shared/application/pagination';
import {
  CreateCatalogItemDto,
  ListCatalogItemsQuery,
  UpdateCatalogItemDto,
} from '../../../platform-catalog/application/dto/catalog-item.dto';
import { CatalogItemResponse } from '../../../platform-catalog/application/dto/catalog-responses';
import {
  ImportCatalogItemsRequestDto,
  ImportCatalogItemsResponse,
} from '../../../platform-catalog/application/dto/import-catalog-items.dto';
import { CreateCatalogItemUseCase } from '../../../platform-catalog/application/commands/create-catalog-item.usecase';
import { UpdateCatalogItemUseCase } from '../../../platform-catalog/application/commands/update-catalog-item.usecase';
import { ArchiveCatalogItemUseCase } from '../../../platform-catalog/application/commands/archive-catalog-item.usecase';
import { ImportCatalogItemsUseCase } from '../../../platform-catalog/application/commands/import-catalog-items.usecase';
import { GetCatalogItemUseCase } from '../../../platform-catalog/application/queries/get-catalog-item.usecase';
import { ListCatalogItemsUseCase } from '../../../platform-catalog/application/queries/list-catalog-items.usecase';
import { PlatformAuthGuard } from '../platform-auth.guard';

/**
 * Platform-admin CatalogItem CRUD (ADR §4). Guarded solely by PlatformAuthGuard.
 * Touches CatalogItem + taxonomy only — no tenant StockItem access, no usage/adopter
 * lookups. Delete is archive (soft) so tenant references never orphan.
 */
@ApiTags('platform-catalog-items')
@ApiBearerAuth('platform-token')
@Public()
@UseGuards(PlatformAuthGuard)
@Controller('platform/catalog-items')
export class PlatformCatalogItemsController {
  constructor(
    private readonly listItems: ListCatalogItemsUseCase,
    private readonly getItem: GetCatalogItemUseCase,
    private readonly createItem: CreateCatalogItemUseCase,
    private readonly updateItem: UpdateCatalogItemUseCase,
    private readonly archiveItem: ArchiveCatalogItemUseCase,
    private readonly importItems: ImportCatalogItemsUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List catalog items (active by default; paged + search).' })
  @ApiOkResponse({ type: [CatalogItemResponse] })
  async list(@Query() query: ListCatalogItemsQuery): Promise<Paginated<CatalogItemResponse>> {
    const result = await this.listItems.execute({
      page: query.page,
      limit: query.limit,
      q: query.q,
      categoryId: query.categoryId,
      includeArchived: query.includeArchived,
    });
    return { data: result.data.map(CatalogItemResponse.from), pagination: result.pagination };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a catalog item by id.' })
  @ApiOkResponse({ type: CatalogItemResponse })
  async get(@Param('id') id: string): Promise<CatalogItemResponse> {
    return CatalogItemResponse.from(await this.getItem.execute({ catalogItemId: id }));
  }

  @Post()
  @ApiOperation({ summary: 'Create a catalog item.' })
  @ApiOkResponse({ type: CatalogItemResponse })
  async create(@Body() dto: CreateCatalogItemDto): Promise<CatalogItemResponse> {
    const item = await this.createItem.execute({
      slug: dto.slug,
      nameHy: dto.nameHy,
      nameRu: dto.nameRu,
      nameEn: dto.nameEn,
      categoryId: dto.categoryId ?? null,
    });
    return CatalogItemResponse.from(item);
  }

  @Post('import')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Bulk import catalog items from CSV (dry-run preview or transactional apply).',
  })
  @ApiOkResponse({ type: ImportCatalogItemsResponse })
  async import(@Body() dto: ImportCatalogItemsRequestDto): Promise<ImportCatalogItemsResponse> {
    return this.importItems.execute({
      mode: dto.mode,
      conflictStrategy: dto.conflictStrategy,
      csv: dto.csv,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a catalog item.' })
  @ApiOkResponse({ type: CatalogItemResponse })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCatalogItemDto,
  ): Promise<CatalogItemResponse> {
    const item = await this.updateItem.execute({
      catalogItemId: id,
      nameHy: dto.nameHy,
      nameRu: dto.nameRu,
      nameEn: dto.nameEn,
      categoryId: dto.categoryId,
    });
    return CatalogItemResponse.from(item);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @ApiOperation({ summary: 'Archive (soft-delete) a catalog item.' })
  @ApiOkResponse({ type: CatalogItemResponse })
  async archive(@Param('id') id: string): Promise<CatalogItemResponse> {
    return CatalogItemResponse.from(await this.archiveItem.execute({ catalogItemId: id }));
  }
}
