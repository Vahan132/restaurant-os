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
import { ChangeTableStatusManualUseCase } from '../../application/commands/change-table-status-manual.usecase';
import { CreateTableUseCase } from '../../application/commands/create-table.usecase';
import { DeleteTableUseCase } from '../../application/commands/delete-table.usecase';
import { UpdateTableUseCase } from '../../application/commands/update-table.usecase';
import {
  ChangeTableStatusDto,
  CreateTableDto,
  ListTablesQuery,
  UpdateTableDto,
} from '../../application/dto/table.dto';
import { TableResponse } from '../../application/dto/responses';
import { FloorPlanFloor } from '../../application/ports/floor-plan.reader';
import { GetFloorPlanUseCase } from '../../application/queries/get-floor-plan.usecase';
import { GetTableUseCase } from '../../application/queries/get-table.usecase';
import { ListTablesUseCase } from '../../application/queries/list-tables.usecase';

const TABLE_MANAGE = PERMISSIONS.TABLE_MANAGE;
const TABLE_STATUS_UPDATE = PERMISSIONS.TABLE_STATUS_UPDATE;

@ApiTags('tables')
@ApiBearerAuth('access-token')
@Controller('tables')
export class TablesController {
  constructor(
    private readonly getFloorPlan: GetFloorPlanUseCase,
    private readonly listTables: ListTablesUseCase,
    private readonly getTable: GetTableUseCase,
    private readonly createTable: CreateTableUseCase,
    private readonly updateTable: UpdateTableUseCase,
    private readonly deleteTable: DeleteTableUseCase,
    private readonly changeStatusManual: ChangeTableStatusManualUseCase,
  ) {}

  // NOTE: declared before ':id' so "floor-plan" is not captured as an id param.
  @Get('floor-plan')
  @ApiOperation({ summary: 'Get the floor plan (floors -> tables with status).' })
  @ApiOkResponse({ description: 'Active floors with their tables.' })
  floorPlan(@CurrentTenant() tenant: TenantContext): Promise<FloorPlanFloor[]> {
    return this.getFloorPlan.execute({ restaurantId: tenant.restaurantId });
  }

  @Get()
  @ApiOperation({ summary: 'List tables (filter by floorId / status).' })
  @ApiOkResponse({ type: [TableResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListTablesQuery,
  ): Promise<TableResponse[]> {
    const tables = await this.listTables.execute({
      restaurantId: tenant.restaurantId,
      floorId: query.floorId,
      status: query.status,
    });
    return tables.map(TableResponse.from);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a table by id.' })
  @ApiOkResponse({ type: TableResponse })
  async get(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<TableResponse> {
    const table = await this.getTable.execute({ restaurantId: tenant.restaurantId, tableId: id });
    return TableResponse.from(table);
  }

  @Post()
  @RequirePermissions(TABLE_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing TABLE_MANAGE permission.' })
  @ApiOperation({ summary: 'Create a table.' })
  @ApiCreatedResponse({ type: TableResponse })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateTableDto,
  ): Promise<TableResponse> {
    const table = await this.createTable.execute({
      restaurantId: tenant.restaurantId,
      floorId: dto.floorId,
      name: dto.name,
      seatCapacity: dto.seatCapacity,
      qrIdentifier: dto.qrIdentifier ?? null,
    });
    return TableResponse.from(table);
  }

  @Patch(':id')
  @RequirePermissions(TABLE_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing TABLE_MANAGE permission.' })
  @ApiOperation({ summary: 'Update a table (config).' })
  @ApiOkResponse({ type: TableResponse })
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateTableDto,
  ): Promise<TableResponse> {
    const table = await this.updateTable.execute({
      restaurantId: tenant.restaurantId,
      tableId: id,
      name: dto.name,
      seatCapacity: dto.seatCapacity,
      floorId: dto.floorId,
      qrIdentifier: dto.qrIdentifier,
    });
    return TableResponse.from(table);
  }

  @Delete(':id')
  @RequirePermissions(TABLE_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing TABLE_MANAGE permission.' })
  @ApiOperation({ summary: 'Soft-delete a table (blocked if OCCUPIED/RESERVED).' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.deleteTable.execute({ restaurantId: tenant.restaurantId, tableId: id });
    return { success: true };
  }

  @Patch(':id/status')
  @RequirePermissions(TABLE_STATUS_UPDATE)
  @ApiForbiddenResponse({ description: 'Missing TABLE_STATUS_UPDATE permission.' })
  @ApiOperation({ summary: 'Manual table status change (toggle-gated state machine).' })
  @ApiOkResponse({ type: TableResponse })
  async changeStatus(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: ChangeTableStatusDto,
  ): Promise<TableResponse> {
    const table = await this.changeStatusManual.execute({
      restaurantId: tenant.restaurantId,
      tableId: id,
      status: dto.status,
    });
    return TableResponse.from(table);
  }
}
