import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { TenantContext } from '../../../../shared/tenancy/tenant-context';
import { CreateCategoryUseCase } from '../../application/commands/create-category.usecase';
import { DeleteCategoryUseCase } from '../../application/commands/delete-category.usecase';
import { ReorderCategoriesUseCase } from '../../application/commands/reorder-categories.usecase';
import { SetCategoryStatusUseCase } from '../../application/commands/set-category-status.usecase';
import { UpdateCategoryUseCase } from '../../application/commands/update-category.usecase';
import {
  CreateCategoryDto,
  ListCategoriesQuery,
  ReorderCategoriesDto,
  SetCategoryStatusDto,
  UpdateCategoryDto,
} from '../../application/dto/category.dto';
import { CategoryResponse } from '../../application/dto/responses';
import { ListCategoriesUseCase } from '../../application/queries/list-categories.usecase';

const MENU_MANAGE = PERMISSIONS.MENU_MANAGE;

@ApiTags('menu-categories')
@ApiBearerAuth('access-token')
@Controller('menu/categories')
export class CategoriesController {
  constructor(
    private readonly listCategories: ListCategoriesUseCase,
    private readonly createCategory: CreateCategoryUseCase,
    private readonly updateCategory: UpdateCategoryUseCase,
    private readonly setStatus: SetCategoryStatusUseCase,
    private readonly reorder: ReorderCategoriesUseCase,
    private readonly deleteCategory: DeleteCategoryUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List categories (ordered).' })
  @ApiOkResponse({ type: [CategoryResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListCategoriesQuery,
  ): Promise<CategoryResponse[]> {
    const categories = await this.listCategories.execute({
      restaurantId: tenant.restaurantId,
      status: query.status,
      includeInactive: query.includeInactive,
    });
    return categories.map(CategoryResponse.from);
  }

  @Post()
  @RequirePermissions(MENU_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Create a category.' })
  @ApiCreatedResponse({ type: CategoryResponse })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateCategoryDto,
  ): Promise<CategoryResponse> {
    const c = await this.createCategory.execute({
      restaurantId: tenant.restaurantId,
      name: dto.name,
      description: dto.description ?? null,
      displayOrder: dto.displayOrder,
    });
    return CategoryResponse.from(c);
  }

  @Post('reorder')
  @RequirePermissions(MENU_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Reorder categories.' })
  @ApiOkResponse({ type: [CategoryResponse] })
  async reorderCategories(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: ReorderCategoriesDto,
  ): Promise<CategoryResponse[]> {
    const updated = await this.reorder.execute({
      restaurantId: tenant.restaurantId,
      order: dto.order,
    });
    return updated.map(CategoryResponse.from);
  }

  @Patch(':id')
  @RequirePermissions(MENU_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Update a category.' })
  @ApiOkResponse({ type: CategoryResponse })
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponse> {
    const c = await this.updateCategory.execute({
      restaurantId: tenant.restaurantId,
      categoryId: id,
      name: dto.name,
      description: dto.description,
      displayOrder: dto.displayOrder,
    });
    return CategoryResponse.from(c);
  }

  @Patch(':id/status')
  @RequirePermissions(MENU_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Activate/deactivate a category.' })
  @ApiOkResponse({ type: CategoryResponse })
  async status(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: SetCategoryStatusDto,
  ): Promise<CategoryResponse> {
    const c = await this.setStatus.execute({
      restaurantId: tenant.restaurantId,
      categoryId: id,
      status: dto.status,
    });
    return CategoryResponse.from(c);
  }

  @Delete(':id')
  @RequirePermissions(MENU_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Soft-delete a category (blocked if it has items).' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.deleteCategory.execute({ restaurantId: tenant.restaurantId, categoryId: id });
    return { success: true };
  }
}
