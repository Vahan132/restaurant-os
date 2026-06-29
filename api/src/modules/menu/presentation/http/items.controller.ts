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
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { AttachModifierGroupToDishUseCase } from '../../application/commands/add-modifier-group.usecase';
import { ChangeItemPriceUseCase } from '../../application/commands/change-item-price.usecase';
import { CreateMenuItemUseCase } from '../../application/commands/create-menu-item.usecase';
import { DeleteMenuItemUseCase } from '../../application/commands/delete-menu-item.usecase';
import { DetachModifierGroupFromDishUseCase } from '../../application/commands/detach-modifier-group.usecase';
import { ReorderDishModifierGroupsUseCase } from '../../application/commands/reorder-dish-modifier-groups.usecase';
import { SetDishModifierOverridesUseCase } from '../../application/commands/set-dish-modifier-overrides.usecase';
import { SetItemAvailabilityUseCase } from '../../application/commands/set-item-availability.usecase';
import { SetItemStatusUseCase } from '../../application/commands/set-item-status.usecase';
import { UpdateMenuItemUseCase } from '../../application/commands/update-menu-item.usecase';
import {
  AttachModifierGroupDto,
  ReorderDishModifierGroupsDto,
  SetDishModifierOverridesDto,
} from '../../application/dto/dish-modifier.dto';
import {
  ChangeItemPriceDto,
  CreateMenuItemDto,
  ListMenuItemsQuery,
  SetItemAvailabilityDto,
  SetItemStatusDto,
  UpdateMenuItemDto,
} from '../../application/dto/item.dto';
import {
  DishModifierGroupResponse,
  MenuItemDetailResponse,
  MenuItemResponse,
} from '../../application/dto/responses';
import { GetMenuItemUseCase } from '../../application/queries/get-menu-item.usecase';
import { ListMenuItemsUseCase } from '../../application/queries/list-menu-items.usecase';

const MENU_MANAGE = PERMISSIONS.MENU_MANAGE;
const MENU_ITEM_SET_PRICE = PERMISSIONS.MENU_ITEM_SET_PRICE;

@ApiTags('menu-items')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('menu/items')
export class ItemsController {
  constructor(
    private readonly listItems: ListMenuItemsUseCase,
    private readonly getItem: GetMenuItemUseCase,
    private readonly createItem: CreateMenuItemUseCase,
    private readonly updateItem: UpdateMenuItemUseCase,
    private readonly changePrice: ChangeItemPriceUseCase,
    private readonly setStatus: SetItemStatusUseCase,
    private readonly setAvailability: SetItemAvailabilityUseCase,
    private readonly deleteItem: DeleteMenuItemUseCase,
    private readonly attachGroup: AttachModifierGroupToDishUseCase,
    private readonly detachGroup: DetachModifierGroupFromDishUseCase,
    private readonly setOverrides: SetDishModifierOverridesUseCase,
    private readonly reorderGroups: ReorderDishModifierGroupsUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List menu items (paginated, filterable).' })
  @ApiOkResponse({ type: [MenuItemResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Query() query: ListMenuItemsQuery,
  ): Promise<Paginated<MenuItemResponse>> {
    const page = await this.listItems.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      categoryId: query.categoryId,
      status: query.status,
      availability: query.availability,
      search: query.q,
      page: query.page,
      limit: query.limit,
    });
    return { data: page.data.map(MenuItemResponse.from), pagination: page.pagination };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a menu item with its modifier groups + options.' })
  @ApiOkResponse({ type: MenuItemDetailResponse })
  async get(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
  ): Promise<MenuItemDetailResponse> {
    const detail = await this.getItem.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      itemId: id,
    });
    return MenuItemDetailResponse.fromDetail(detail);
  }

  @Post()
  @RequirePermissions(MENU_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Create a menu item.' })
  @ApiCreatedResponse({ type: MenuItemResponse })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @CurrentUser() actor: CurrentUserContext,
    @Body() dto: CreateMenuItemDto,
  ): Promise<MenuItemResponse> {
    const item = await this.createItem.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      categoryId: dto.categoryId,
      name: dto.name,
      description: dto.description ?? null,
      // Price is NOT settable on create (INV-3 §7); items start at 0 and price is
      // set via PATCH :id/price under menu:item:set_price.
      priceAmount: 0,
      imageUrl: dto.imageUrl ?? null,
      preparationStation: dto.preparationStation,
      prepTimeMinutes: dto.prepTimeMinutes ?? null,
      actorUserId: actor.sub,
    });
    return MenuItemResponse.from(item);
  }

  @Patch(':id')
  @RequirePermissions(MENU_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Update a menu item.' })
  @ApiOkResponse({ type: MenuItemResponse })
  async update(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMenuItemDto,
  ): Promise<MenuItemResponse> {
    const item = await this.updateItem.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      itemId: id,
      name: dto.name,
      description: dto.description,
      imageUrl: dto.imageUrl,
      categoryId: dto.categoryId,
      preparationStation: dto.preparationStation,
      prepTimeMinutes: dto.prepTimeMinutes,
    });
    return MenuItemResponse.from(item);
  }

  @Patch(':id/price')
  @RequirePermissions(MENU_ITEM_SET_PRICE)
  @ApiForbiddenResponse({ description: 'Missing menu:item:set_price permission.' })
  @ApiOperation({ summary: 'Set a menu item price (separate permission from item manage).' })
  @ApiOkResponse({ type: MenuItemResponse })
  async price(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @CurrentUser() actor: CurrentUserContext,
    @Param('id') id: string,
    @Body() dto: ChangeItemPriceDto,
  ): Promise<MenuItemResponse> {
    const item = await this.changePrice.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      itemId: id,
      priceAmount: dto.priceAmount,
      actorUserId: actor.sub,
    });
    return MenuItemResponse.from(item);
  }

  @Patch(':id/status')
  @RequirePermissions(MENU_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Set item status (INACTIVE hides it from POS).' })
  @ApiOkResponse({ type: MenuItemResponse })
  async status(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
    @Body() dto: SetItemStatusDto,
  ): Promise<MenuItemResponse> {
    const item = await this.setStatus.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      itemId: id,
      status: dto.status,
    });
    return MenuItemResponse.from(item);
  }

  @Patch(':id/availability')
  @RequirePermissions(MENU_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Toggle item availability (shown but disabled when UNAVAILABLE).' })
  @ApiOkResponse({ type: MenuItemResponse })
  async availability(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
    @Body() dto: SetItemAvailabilityDto,
  ): Promise<MenuItemResponse> {
    const item = await this.setAvailability.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      itemId: id,
      availability: dto.availability,
    });
    return MenuItemResponse.from(item);
  }

  @Delete(':id')
  @RequirePermissions(MENU_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Soft-delete a menu item.' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @CurrentUser() actor: CurrentUserContext,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.deleteItem.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      itemId: id,
      actorUserId: actor.sub,
    });
    return { success: true };
  }

  // ── Dish ↔ reusable modifier-group attachments (Prompt 1A) ─────────────────

  @Post(':itemId/modifier-groups')
  @RequirePermissions(MENU_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Attach a reusable modifier group to a dish.' })
  @ApiCreatedResponse({ type: DishModifierGroupResponse })
  async attachModifierGroup(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('itemId') itemId: string,
    @Body() dto: AttachModifierGroupDto,
  ): Promise<DishModifierGroupResponse> {
    const attachment = await this.attachGroup.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      itemId,
      groupId: dto.groupId,
      requiredOverride: dto.requiredOverride,
      minOverride: dto.minOverride,
      maxOverride: dto.maxOverride,
      sortOrder: dto.sortOrder,
    });
    return DishModifierGroupResponse.from(attachment);
  }

  // NOTE: declared BEFORE ':itemId/modifier-groups/:groupId' so "reorder" is
  // matched ahead of the :groupId param.
  @Patch(':itemId/modifier-groups/reorder')
  @RequirePermissions(MENU_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: "Reorder a dish's attached modifier groups." })
  @ApiOkResponse({ type: [DishModifierGroupResponse] })
  async reorderModifierGroups(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('itemId') itemId: string,
    @Body() dto: ReorderDishModifierGroupsDto,
  ): Promise<DishModifierGroupResponse[]> {
    const attachments = await this.reorderGroups.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      itemId,
      orderedGroupIds: dto.groupIds,
    });
    return attachments.map(DishModifierGroupResponse.from);
  }

  @Patch(':itemId/modifier-groups/:groupId')
  @RequirePermissions(MENU_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: "Set or clear a dish attachment's per-group overrides." })
  @ApiOkResponse({ type: DishModifierGroupResponse })
  async setModifierGroupOverrides(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('itemId') itemId: string,
    @Param('groupId') groupId: string,
    @Body() dto: SetDishModifierOverridesDto,
  ): Promise<DishModifierGroupResponse> {
    const attachment = await this.setOverrides.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      itemId,
      groupId,
      requiredOverride: dto.requiredOverride,
      minOverride: dto.minOverride,
      maxOverride: dto.maxOverride,
      sortOrder: dto.sortOrder,
    });
    return DishModifierGroupResponse.from(attachment);
  }

  @Delete(':itemId/modifier-groups/:groupId')
  @RequirePermissions(MENU_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Detach a modifier group from a dish.' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async detachModifierGroup(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('itemId') itemId: string,
    @Param('groupId') groupId: string,
  ): Promise<{ success: true }> {
    await this.detachGroup.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      itemId,
      groupId,
    });
    return { success: true };
  }
}
