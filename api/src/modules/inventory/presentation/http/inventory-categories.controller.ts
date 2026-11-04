import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Paginated } from '../../../../shared/application/pagination';
import { ActiveBranchId } from '../../../../shared/auth/active-branch.decorator';
import { BranchScoped } from '../../../../shared/auth/branch-scoped.decorator';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import {
  CreateInventoryCategoryUseCase,
  DeleteInventoryCategoryUseCase,
  UpdateInventoryCategoryUseCase,
} from '../../application/commands/manage-category.usecase';
import {
  CreateInventoryCategoryDto,
  ListInventoryCategoriesQuery,
  UpdateInventoryCategoryDto,
} from '../../application/dto/category.dto';
import { InventoryCategoryResponse } from '../../application/dto/responses';
import { ListInventoryCategoriesUseCase } from '../../application/queries/list-inventory-categories.usecase';

const READ = PERMISSIONS.INVENTORY_READ;
const MANAGE = PERMISSIONS.INVENTORY_ITEM_MANAGE;

@ApiTags('inventory-categories')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('inventory/categories')
export class InventoryCategoriesController {
  constructor(
    private readonly listCategories: ListInventoryCategoriesUseCase,
    private readonly createCategory: CreateInventoryCategoryUseCase,
    private readonly updateCategory: UpdateInventoryCategoryUseCase,
    private readonly deleteCategory: DeleteInventoryCategoryUseCase,
  ) {}

  @Get()
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'List inventory categories (paginated).' })
  @ApiOkResponse({ type: [InventoryCategoryResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Query() query: ListInventoryCategoriesQuery,
  ): Promise<Paginated<InventoryCategoryResponse>> {
    const page = await this.listCategories.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      page: query.page,
      limit: query.limit,
    });
    return { data: page.data.map(InventoryCategoryResponse.from), pagination: page.pagination };
  }

  @Post()
  @RequirePermissions(MANAGE)
  @ApiForbiddenResponse({ description: 'Missing inventory:item:manage permission.' })
  @ApiOperation({ summary: 'Create an inventory category.' })
  @ApiCreatedResponse({ type: InventoryCategoryResponse })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Body() dto: CreateInventoryCategoryDto,
  ): Promise<InventoryCategoryResponse> {
    const category = await this.createCategory.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      name: dto.name,
    });
    return InventoryCategoryResponse.from(category);
  }

  @Patch(':id')
  @RequirePermissions(MANAGE)
  @ApiForbiddenResponse({ description: 'Missing inventory:item:manage permission.' })
  @ApiOperation({ summary: 'Rename an inventory category.' })
  @ApiOkResponse({ type: InventoryCategoryResponse })
  async update(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryCategoryDto,
  ): Promise<InventoryCategoryResponse> {
    const category = await this.updateCategory.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      id,
      name: dto.name,
    });
    return InventoryCategoryResponse.from(category);
  }

  @Delete(':id')
  @RequirePermissions(MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing inventory:item:manage permission.' })
  @ApiOperation({ summary: 'Soft-delete an inventory category.' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.deleteCategory.execute({ restaurantId: tenant.restaurantId, branchId, id });
    return { success: true };
  }
}
