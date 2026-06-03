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
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { AddModifierGroupUseCase } from '../../application/commands/add-modifier-group.usecase';
import { ChangeItemPriceUseCase } from '../../application/commands/change-item-price.usecase';
import { CreateMenuItemUseCase } from '../../application/commands/create-menu-item.usecase';
import { DeleteMenuItemUseCase } from '../../application/commands/delete-menu-item.usecase';
import { SetItemAvailabilityUseCase } from '../../application/commands/set-item-availability.usecase';
import { SetItemStatusUseCase } from '../../application/commands/set-item-status.usecase';
import { UpdateMenuItemUseCase } from '../../application/commands/update-menu-item.usecase';
import { CreateModifierGroupDto } from '../../application/dto/modifier.dto';
import {
  ChangeItemPriceDto,
  CreateMenuItemDto,
  ListMenuItemsQuery,
  SetItemAvailabilityDto,
  SetItemStatusDto,
  UpdateMenuItemDto,
} from '../../application/dto/item.dto';
import {
  MenuItemDetailResponse,
  MenuItemResponse,
  ModifierGroupResponse,
} from '../../application/dto/responses';
import { GetMenuItemUseCase } from '../../application/queries/get-menu-item.usecase';
import { ListMenuItemsUseCase } from '../../application/queries/list-menu-items.usecase';

const MENU_MANAGE = PERMISSIONS.MENU_MANAGE;

@ApiTags('menu-items')
@ApiBearerAuth('access-token')
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
    private readonly addGroup: AddModifierGroupUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List menu items (paginated, filterable).' })
  @ApiOkResponse({ type: [MenuItemResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListMenuItemsQuery,
  ): Promise<Paginated<MenuItemResponse>> {
    const page = await this.listItems.execute({
      restaurantId: tenant.restaurantId,
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
    @Param('id') id: string,
  ): Promise<MenuItemDetailResponse> {
    const detail = await this.getItem.execute({ restaurantId: tenant.restaurantId, itemId: id });
    return MenuItemDetailResponse.fromDetail(detail);
  }

  @Post()
  @RequirePermissions(MENU_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Create a menu item.' })
  @ApiCreatedResponse({ type: MenuItemResponse })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: CurrentUserContext,
    @Body() dto: CreateMenuItemDto,
  ): Promise<MenuItemResponse> {
    const item = await this.createItem.execute({
      restaurantId: tenant.restaurantId,
      categoryId: dto.categoryId,
      name: dto.name,
      description: dto.description ?? null,
      priceAmount: dto.priceAmount,
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
    @Param('id') id: string,
    @Body() dto: UpdateMenuItemDto,
  ): Promise<MenuItemResponse> {
    const item = await this.updateItem.execute({
      restaurantId: tenant.restaurantId,
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
  @RequirePermissions(MENU_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Change a menu item price.' })
  @ApiOkResponse({ type: MenuItemResponse })
  async price(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: CurrentUserContext,
    @Param('id') id: string,
    @Body() dto: ChangeItemPriceDto,
  ): Promise<MenuItemResponse> {
    const item = await this.changePrice.execute({
      restaurantId: tenant.restaurantId,
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
    @Param('id') id: string,
    @Body() dto: SetItemStatusDto,
  ): Promise<MenuItemResponse> {
    const item = await this.setStatus.execute({
      restaurantId: tenant.restaurantId,
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
    @Param('id') id: string,
    @Body() dto: SetItemAvailabilityDto,
  ): Promise<MenuItemResponse> {
    const item = await this.setAvailability.execute({
      restaurantId: tenant.restaurantId,
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
    @CurrentUser() actor: CurrentUserContext,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.deleteItem.execute({
      restaurantId: tenant.restaurantId,
      itemId: id,
      actorUserId: actor.sub,
    });
    return { success: true };
  }

  @Post(':itemId/modifier-groups')
  @RequirePermissions(MENU_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Add a modifier group to an item.' })
  @ApiCreatedResponse({ type: ModifierGroupResponse })
  async addModifierGroup(
    @CurrentTenant() tenant: TenantContext,
    @Param('itemId') itemId: string,
    @Body() dto: CreateModifierGroupDto,
  ): Promise<ModifierGroupResponse> {
    const group = await this.addGroup.execute({
      restaurantId: tenant.restaurantId,
      itemId,
      name: dto.name,
      selectionType: dto.selectionType,
      required: dto.required,
      minSelect: dto.minSelect ?? null,
      maxSelect: dto.maxSelect ?? null,
      displayOrder: dto.displayOrder,
    });
    return ModifierGroupResponse.from(group);
  }
}
