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
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { CreateInventoryItemUseCase } from '../../application/commands/create-inventory-item.usecase';
import { DeleteInventoryItemUseCase } from '../../application/commands/delete-inventory-item.usecase';
import { SetItemConsumptionLocationUseCase } from '../../application/commands/set-item-consumption-location.usecase';
import { UpdateInventoryItemUseCase } from '../../application/commands/update-inventory-item.usecase';
import {
  CreateInventoryItemDto,
  ListInventoryItemsQuery,
  SetItemConsumptionLocationDto,
  UpdateInventoryItemDto,
} from '../../application/dto/item.dto';
import {
  InventoryItemResponse,
  StockLayerResponse,
  StockMovementResponse,
} from '../../application/dto/responses';
import { ItemLayersQuery, ItemMovementsQuery } from '../../application/dto/stock-query.dto';
import { GetInventoryItemUseCase } from '../../application/queries/get-inventory-item.usecase';
import { GetItemLayersUseCase } from '../../application/queries/get-item-layers.usecase';
import { GetItemMovementsUseCase } from '../../application/queries/get-item-movements.usecase';
import { ListInventoryItemsUseCase } from '../../application/queries/list-inventory-items.usecase';

const READ = PERMISSIONS.INVENTORY_READ;
const MANAGE = PERMISSIONS.INVENTORY_ITEM_MANAGE;

@ApiTags('inventory-items')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('inventory/items')
export class InventoryItemsController {
  constructor(
    private readonly listItems: ListInventoryItemsUseCase,
    private readonly getItem: GetInventoryItemUseCase,
    private readonly createItem: CreateInventoryItemUseCase,
    private readonly updateItem: UpdateInventoryItemUseCase,
    private readonly deleteItem: DeleteInventoryItemUseCase,
    private readonly setConsumptionLocation: SetItemConsumptionLocationUseCase,
    private readonly getLayers: GetItemLayersUseCase,
    private readonly getMovements: GetItemMovementsUseCase,
  ) {}

  @Get()
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'List inventory items (paginated, filterable).' })
  @ApiOkResponse({ type: [InventoryItemResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Query() query: ListInventoryItemsQuery,
  ): Promise<Paginated<InventoryItemResponse>> {
    const page = await this.listItems.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      categoryId: query.categoryId,
      kind: query.kind,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
    return { data: page.data.map(InventoryItemResponse.from), pagination: page.pagination };
  }

  @Get(':id')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Get an inventory item (all catalog fields incl. kind).' })
  @ApiOkResponse({ type: InventoryItemResponse })
  async get(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
  ): Promise<InventoryItemResponse> {
    const item = await this.getItem.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      itemId: id,
    });
    return InventoryItemResponse.from(item);
  }

  @Post()
  @RequirePermissions(MANAGE)
  @ApiForbiddenResponse({ description: 'Missing inventory:item:manage permission.' })
  @ApiOperation({ summary: 'Create an inventory item (RAW or PROCESSED).' })
  @ApiCreatedResponse({ type: InventoryItemResponse })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @CurrentUser() actor: CurrentUserContext,
    @Body() dto: CreateInventoryItemDto,
  ): Promise<InventoryItemResponse> {
    const item = await this.createItem.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      name: dto.name,
      baseUnit: dto.baseUnit,
      kind: dto.kind,
      categoryId: dto.categoryId ?? null,
      sku: dto.sku ?? null,
      alternateUnits: dto.alternateUnits,
      trackExpiry: dto.trackExpiry,
      lowStockThresholdBase: dto.lowStockThresholdBase ?? null,
      actorUserId: actor.sub,
    });
    return InventoryItemResponse.from(item);
  }

  @Patch(':id')
  @RequirePermissions(MANAGE)
  @ApiForbiddenResponse({ description: 'Missing inventory:item:manage permission.' })
  @ApiOperation({ summary: 'Update an inventory item (kind round-trips).' })
  @ApiOkResponse({ type: InventoryItemResponse })
  async update(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryItemDto,
  ): Promise<InventoryItemResponse> {
    const item = await this.updateItem.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      itemId: id,
      name: dto.name,
      kind: dto.kind,
      categoryId: dto.categoryId,
      sku: dto.sku,
      alternateUnits: dto.alternateUnits,
      trackExpiry: dto.trackExpiry,
      lowStockThresholdBase: dto.lowStockThresholdBase,
    });
    return InventoryItemResponse.from(item);
  }

  @Delete(':id')
  @RequirePermissions(MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing inventory:item:manage permission.' })
  @ApiOperation({ summary: 'Soft-delete an inventory item.' })
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

  @Patch(':id/consumption-location')
  @RequirePermissions(MANAGE)
  @ApiForbiddenResponse({ description: 'Missing inventory:item:manage permission.' })
  @ApiOperation({ summary: "Reassign the item's serve-time consumption location (6C)." })
  @ApiOkResponse({ type: InventoryItemResponse })
  async setConsumptionLocationRoute(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
    @Body() dto: SetItemConsumptionLocationDto,
  ): Promise<InventoryItemResponse> {
    const item = await this.setConsumptionLocation.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      itemId: id,
      locationId: dto.locationId ?? null,
    });
    return InventoryItemResponse.from(item);
  }

  @Get(':id/layers')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'List an item stock layers (OPEN by default) with derived unit cost.' })
  @ApiOkResponse({ type: [StockLayerResponse] })
  async layers(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
    @Query() query: ItemLayersQuery,
  ): Promise<StockLayerResponse[]> {
    const layers = await this.getLayers.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      itemId: id,
      includeAll: query.all === 'true',
    });
    return layers.map(StockLayerResponse.from);
  }

  @Get(':id/movements')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Paginated movement ledger for an item.' })
  @ApiOkResponse({ type: [StockMovementResponse] })
  async movements(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
    @Query() query: ItemMovementsQuery,
  ): Promise<Paginated<StockMovementResponse>> {
    const page = await this.getMovements.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      itemId: id,
      page: query.page,
      limit: query.limit,
    });
    return { data: page.data.map(StockMovementResponse.from), pagination: page.pagination };
  }
}
