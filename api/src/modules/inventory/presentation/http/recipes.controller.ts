import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Paginated } from '../../../../shared/application/pagination';
import { ActiveBranchId } from '../../../../shared/auth/active-branch.decorator';
import { BranchScoped } from '../../../../shared/auth/branch-scoped.decorator';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { CreateRecipeUseCase } from '../../application/commands/create-recipe.usecase';
import { DeleteRecipeUseCase } from '../../application/commands/delete-recipe.usecase';
import { UpdateRecipeUseCase } from '../../application/commands/update-recipe.usecase';
import {
  CreateRecipeDto,
  ListRecipesQuery,
  UpdateRecipeDto,
} from '../../application/dto/recipe.dto';
import {
  MenuCostingRowResponse,
  RecalculateCostsResponse,
  RecipeListItemResponse,
  RecipeResponse,
} from '../../application/dto/recipe-responses';
import {
  GetMenuCostingUseCase,
  RecalculateCostsUseCase,
} from '../../application/queries/get-menu-costing.usecase';
import { GetRecipeUseCase } from '../../application/queries/get-recipe.usecase';
import { toLocale } from '../../application/services/dish-projection.resolver';
import { ListRecipesUseCase } from '../../application/queries/list-recipes.usecase';

const READ = PERMISSIONS.INVENTORY_READ;
const MANAGE = PERMISSIONS.INVENTORY_RECIPE_MANAGE;

@ApiTags('inventory-recipes')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('inventory/recipes')
export class RecipesController {
  constructor(
    private readonly listRecipes: ListRecipesUseCase,
    private readonly getRecipe: GetRecipeUseCase,
    private readonly createRecipe: CreateRecipeUseCase,
    private readonly updateRecipe: UpdateRecipeUseCase,
    private readonly deleteRecipe: DeleteRecipeUseCase,
    private readonly menuCosting: GetMenuCostingUseCase,
    private readonly recalculate: RecalculateCostsUseCase,
  ) {}

  @Get()
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'List recipes (paginated; ?menuItemId, ?search by dish name).' })
  @ApiOkResponse({ type: [RecipeListItemResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Query() query: ListRecipesQuery,
  ): Promise<Paginated<RecipeListItemResponse>> {
    const page = await this.listRecipes.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      menuItemId: query.menuItemId,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
    return { data: page.data.map(RecipeListItemResponse.from), pagination: page.pagination };
  }

  // Declared BEFORE ':id' so "costing" is not captured as a recipe id.
  @Get('costing')
  @RequirePermissions(READ)
  @ApiOperation({
    summary:
      'COST-FIFO-1: live dish cost price per recipe (brutto x the batch currently being ' +
      'consumed) + the last cost-price change.',
  })
  @ApiOkResponse({ type: [MenuCostingRowResponse] })
  async costing(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
  ): Promise<MenuCostingRowResponse[]> {
    const rows = await this.menuCosting.execute({ restaurantId: tenant.restaurantId, branchId });
    return rows.map(MenuCostingRowResponse.from);
  }

  @Post('costing/recalculate')
  @HttpCode(200)
  @RequirePermissions(MANAGE)
  @ApiForbiddenResponse({ description: 'Missing inventory:recipe:manage permission.' })
  @ApiOperation({
    summary: 'COST-FIFO-1: re-evaluate every ingredient batch cost + dish cost in the branch.',
  })
  @ApiOkResponse({ type: RecalculateCostsResponse })
  async recalculateCosts(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
  ): Promise<RecalculateCostsResponse> {
    const r = await this.recalculate.execute({ restaurantId: tenant.restaurantId, branchId });
    return { changedItems: r.changedItemIds.length, changedDishes: r.changedRecipeIds.length };
  }

  @Get(':id')
  @RequirePermissions(READ)
  @ApiOperation({
    summary: 'Get a recipe with lines, modifier consumptions, estimate, warnings, projections.',
  })
  @ApiQuery({ name: 'locale', required: false, enum: ['hy', 'ru', 'en'] })
  @ApiOkResponse({ type: RecipeResponse })
  async get(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
    @Query('locale') locale?: string,
  ): Promise<RecipeResponse> {
    const detail = await this.getRecipe.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      recipeId: id,
      locale: toLocale(locale),
    });
    return RecipeResponse.from(detail);
  }

  @Post()
  @RequirePermissions(MANAGE)
  @ApiForbiddenResponse({ description: 'Missing inventory:recipe:manage permission.' })
  @ApiOperation({ summary: 'Create a recipe for a menu item (includes warnings; always saves).' })
  @ApiQuery({ name: 'locale', required: false, enum: ['hy', 'ru', 'en'] })
  @ApiCreatedResponse({ type: RecipeResponse })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @CurrentUser() actor: CurrentUserContext,
    @Body() dto: CreateRecipeDto,
    @Query('locale') locale?: string,
  ): Promise<RecipeResponse> {
    const detail = await this.createRecipe.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      menuItemId: dto.menuItemId,
      note: dto.note ?? null,
      lines: dto.lines.map((l) => ({
        itemId: l.itemId,
        baseQty: l.baseQty,
        netQty: l.netQty ?? null,
      })),
      modifierConsumptions: (dto.modifierConsumptions ?? []).map((m) => ({
        modifierOptionId: m.modifierOptionId,
        itemId: m.itemId,
        baseQty: m.baseQty,
      })),
      actorUserId: actor.sub,
      locale: toLocale(locale),
    });
    return RecipeResponse.from(detail);
  }

  @Patch(':id')
  @RequirePermissions(MANAGE)
  @ApiForbiddenResponse({ description: 'Missing inventory:recipe:manage permission.' })
  @ApiOperation({ summary: 'Update a recipe (full replace of lines + modifier consumptions).' })
  @ApiQuery({ name: 'locale', required: false, enum: ['hy', 'ru', 'en'] })
  @ApiOkResponse({ type: RecipeResponse })
  async update(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRecipeDto,
    @Query('locale') locale?: string,
  ): Promise<RecipeResponse> {
    const detail = await this.updateRecipe.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      recipeId: id,
      note: dto.note,
      lines: dto.lines?.map((l) => ({
        itemId: l.itemId,
        baseQty: l.baseQty,
        netQty: l.netQty ?? null,
      })),
      modifierConsumptions: dto.modifierConsumptions?.map((m) => ({
        modifierOptionId: m.modifierOptionId,
        itemId: m.itemId,
        baseQty: m.baseQty,
      })),
      locale: toLocale(locale),
    });
    return RecipeResponse.from(detail);
  }

  @Delete(':id')
  @RequirePermissions(MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing inventory:recipe:manage permission.' })
  @ApiOperation({ summary: 'Soft-delete a recipe.' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.deleteRecipe.execute({ restaurantId: tenant.restaurantId, branchId, recipeId: id });
    return { success: true };
  }
}
