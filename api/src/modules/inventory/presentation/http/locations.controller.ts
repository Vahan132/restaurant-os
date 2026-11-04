import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ActiveBranchId } from '../../../../shared/auth/active-branch.decorator';
import { BranchScoped } from '../../../../shared/auth/branch-scoped.decorator';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import {
  CreateInventoryLocationUseCase,
  DeleteInventoryLocationUseCase,
  RenameInventoryLocationUseCase,
} from '../../application/commands/manage-location.usecase';
import {
  CreateInventoryLocationDto,
  UpdateInventoryLocationDto,
} from '../../application/dto/location.dto';
import {
  InventoryLocationResponse,
  OnHandRowResponse,
} from '../../application/dto/location-responses';
import { GetLocationOnHandUseCase } from '../../application/queries/get-location-on-hand.usecase';
import { ListLocationsUseCase } from '../../application/queries/list-locations.usecase';

const READ = PERMISSIONS.INVENTORY_READ;
const MANAGE = PERMISSIONS.INVENTORY_LOCATION_MANAGE;

@ApiTags('inventory-locations')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('inventory/locations')
export class InventoryLocationsController {
  constructor(
    private readonly listLocations: ListLocationsUseCase,
    private readonly createLocation: CreateInventoryLocationUseCase,
    private readonly renameLocation: RenameInventoryLocationUseCase,
    private readonly deleteLocation: DeleteInventoryLocationUseCase,
    private readonly getLocationOnHand: GetLocationOnHandUseCase,
  ) {}

  @Get()
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'List the active stock locations for the active branch.' })
  @ApiOkResponse({ type: [InventoryLocationResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
  ): Promise<InventoryLocationResponse[]> {
    const locations = await this.listLocations.execute({
      restaurantId: tenant.restaurantId,
      branchId,
    });
    return locations.map(InventoryLocationResponse.from);
  }

  @Post()
  @RequirePermissions(MANAGE)
  @ApiForbiddenResponse({ description: 'Missing inventory:location:manage permission.' })
  @ApiOperation({ summary: 'Create a custom stock location (shelf).' })
  @ApiCreatedResponse({ type: InventoryLocationResponse })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Body() dto: CreateInventoryLocationDto,
  ): Promise<InventoryLocationResponse> {
    const location = await this.createLocation.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      name: dto.name,
    });
    return InventoryLocationResponse.from(location);
  }

  @Patch(':id')
  @RequirePermissions(MANAGE)
  @ApiForbiddenResponse({ description: 'Missing inventory:location:manage permission.' })
  @ApiOperation({ summary: 'Rename a stock location.' })
  @ApiOkResponse({ type: InventoryLocationResponse })
  async update(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryLocationDto,
  ): Promise<InventoryLocationResponse> {
    const location = await this.renameLocation.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      id,
      name: dto.name,
    });
    return InventoryLocationResponse.from(location);
  }

  @Delete(':id')
  @RequirePermissions(MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing inventory:location:manage permission.' })
  @ApiOperation({
    summary: 'Delete a CUSTOM location (only when empty; system locations are undeletable).',
  })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.deleteLocation.execute({ restaurantId: tenant.restaurantId, branchId, id });
    return { success: true };
  }

  @Get(':id/on-hand')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'On-hand per item at a single location.' })
  @ApiOkResponse({ type: [OnHandRowResponse] })
  async onHand(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
  ): Promise<OnHandRowResponse[]> {
    const rows = await this.getLocationOnHand.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      locationId: id,
    });
    return rows.map(OnHandRowResponse.from);
  }
}
