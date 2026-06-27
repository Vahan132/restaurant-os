import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
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
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { TenantContext } from '../../../../shared/tenancy/tenant-context';
import { CreateFloorUseCase } from '../../application/commands/create-floor.usecase';
import { DeleteFloorUseCase } from '../../application/commands/delete-floor.usecase';
import { ReorderFloorsUseCase } from '../../application/commands/reorder-floors.usecase';
import { SetFloorStatusUseCase } from '../../application/commands/set-floor-status.usecase';
import { UpdateFloorUseCase } from '../../application/commands/update-floor.usecase';
import {
  CreateFloorDto,
  ListFloorsQuery,
  ReorderFloorsDto,
  SetFloorStatusDto,
  UpdateFloorDto,
} from '../../application/dto/floor.dto';
import { FloorResponse } from '../../application/dto/responses';
import { ListFloorsUseCase } from '../../application/queries/list-floors.usecase';

const TABLE_MANAGE = PERMISSIONS.TABLE_MANAGE;

@ApiTags('floors')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('floors')
export class FloorsController {
  constructor(
    private readonly listFloors: ListFloorsUseCase,
    private readonly createFloor: CreateFloorUseCase,
    private readonly updateFloor: UpdateFloorUseCase,
    private readonly setStatus: SetFloorStatusUseCase,
    private readonly reorder: ReorderFloorsUseCase,
    private readonly deleteFloor: DeleteFloorUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List floors (ordered).' })
  @ApiOkResponse({ type: [FloorResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Query() query: ListFloorsQuery,
  ): Promise<FloorResponse[]> {
    const floors = await this.listFloors.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      status: query.status,
      includeInactive: query.includeInactive === 'true',
    });
    return floors.map(FloorResponse.from);
  }

  @Post()
  @RequirePermissions(TABLE_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing TABLE_MANAGE permission.' })
  @ApiOperation({ summary: 'Create a floor.' })
  @ApiCreatedResponse({ type: FloorResponse })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Body() dto: CreateFloorDto,
  ): Promise<FloorResponse> {
    const f = await this.createFloor.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      name: dto.name,
      description: dto.description ?? null,
      displayOrder: dto.displayOrder,
    });
    return FloorResponse.from(f);
  }

  @Post('reorder')
  @RequirePermissions(TABLE_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing TABLE_MANAGE permission.' })
  @ApiOperation({ summary: 'Reorder floors.' })
  @ApiOkResponse({ type: [FloorResponse] })
  async reorderFloors(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Body() dto: ReorderFloorsDto,
  ): Promise<FloorResponse[]> {
    const updated = await this.reorder.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      order: dto.order,
    });
    return updated.map(FloorResponse.from);
  }

  @Patch(':id')
  @RequirePermissions(TABLE_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing TABLE_MANAGE permission.' })
  @ApiOperation({ summary: 'Update a floor.' })
  @ApiOkResponse({ type: FloorResponse })
  async update(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFloorDto,
  ): Promise<FloorResponse> {
    const f = await this.updateFloor.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      floorId: id,
      name: dto.name,
      description: dto.description,
      displayOrder: dto.displayOrder,
    });
    return FloorResponse.from(f);
  }

  @Patch(':id/status')
  @RequirePermissions(TABLE_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing TABLE_MANAGE permission.' })
  @ApiOperation({ summary: 'Activate/deactivate a floor.' })
  @ApiOkResponse({ type: FloorResponse })
  async status(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
    @Body() dto: SetFloorStatusDto,
  ): Promise<FloorResponse> {
    const f = await this.setStatus.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      floorId: id,
      status: dto.status,
    });
    return FloorResponse.from(f);
  }

  @Delete(':id')
  @RequirePermissions(TABLE_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing TABLE_MANAGE permission.' })
  @ApiOperation({ summary: 'Soft-delete a floor (blocked if it has tables).' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.deleteFloor.execute({ restaurantId: tenant.restaurantId, branchId, floorId: id });
    return { success: true };
  }
}
