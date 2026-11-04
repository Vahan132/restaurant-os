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
import { CreateProcessUseCase } from '../../application/commands/create-process.usecase';
import { DeleteProcessUseCase } from '../../application/commands/delete-process.usecase';
import { RunProcessUseCase } from '../../application/commands/run-process.usecase';
import { UpdateProcessUseCase } from '../../application/commands/update-process.usecase';
import {
  CreateProcessDto,
  ListProcessesQuery,
  UpdateProcessDto,
} from '../../application/dto/process.dto';
import { RunProcessDto } from '../../application/dto/process-run.dto';
import { ProcessResponse, ProcessRunResponse } from '../../application/dto/process-responses';
import { GetProcessUseCase } from '../../application/queries/get-process.usecase';
import { ListProcessesUseCase } from '../../application/queries/list-processes.usecase';

const READ = PERMISSIONS.INVENTORY_READ;
const MANAGE = PERMISSIONS.INVENTORY_PROCESS_MANAGE;
const RUN = PERMISSIONS.INVENTORY_PROCESS_RUN;

@ApiTags('inventory-processes')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('inventory/processes')
export class ProcessesController {
  constructor(
    private readonly listProcesses: ListProcessesUseCase,
    private readonly getProcess: GetProcessUseCase,
    private readonly createProcess: CreateProcessUseCase,
    private readonly updateProcess: UpdateProcessUseCase,
    private readonly deleteProcess: DeleteProcessUseCase,
    private readonly runProcess: RunProcessUseCase,
  ) {}

  @Get()
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'List process definitions (paginated, ?search).' })
  @ApiOkResponse({ type: [ProcessResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Query() query: ListProcessesQuery,
  ): Promise<Paginated<ProcessResponse>> {
    const page = await this.listProcesses.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
    return { data: page.data.map(ProcessResponse.from), pagination: page.pagination };
  }

  @Get(':id')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Get a process with its inputs + outputs.' })
  @ApiOkResponse({ type: ProcessResponse })
  async get(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
  ): Promise<ProcessResponse> {
    const process = await this.getProcess.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      processId: id,
    });
    return ProcessResponse.from(process);
  }

  @Post()
  @RequirePermissions(MANAGE)
  @ApiForbiddenResponse({ description: 'Missing inventory:process:manage permission.' })
  @ApiOperation({ summary: 'Create a process definition.' })
  @ApiCreatedResponse({ type: ProcessResponse })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @CurrentUser() actor: CurrentUserContext,
    @Body() dto: CreateProcessDto,
  ): Promise<ProcessResponse> {
    const process = await this.createProcess.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      name: dto.name,
      processingCostAmount: dto.processingCost_amount,
      note: dto.note ?? null,
      inputs: dto.inputs.map((i) => ({ itemId: i.itemId, baseQty: i.baseQty })),
      outputs: dto.outputs.map((o) => ({
        itemId: o.itemId,
        baseQty: o.baseQty,
        isPrimary: o.isPrimary,
        costShareBps: o.costShareBps ?? null,
      })),
      actorUserId: actor.sub,
    });
    return ProcessResponse.from(process);
  }

  @Patch(':id')
  @RequirePermissions(MANAGE)
  @ApiForbiddenResponse({ description: 'Missing inventory:process:manage permission.' })
  @ApiOperation({ summary: 'Update a process (full replace of inputs/outputs when provided).' })
  @ApiOkResponse({ type: ProcessResponse })
  async update(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProcessDto,
  ): Promise<ProcessResponse> {
    const process = await this.updateProcess.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      processId: id,
      name: dto.name,
      processingCostAmount: dto.processingCost_amount,
      note: dto.note,
      inputs: dto.inputs?.map((i) => ({ itemId: i.itemId, baseQty: i.baseQty })),
      outputs: dto.outputs?.map((o) => ({
        itemId: o.itemId,
        baseQty: o.baseQty,
        isPrimary: o.isPrimary,
        costShareBps: o.costShareBps ?? null,
      })),
    });
    return ProcessResponse.from(process);
  }

  @Delete(':id')
  @RequirePermissions(MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing inventory:process:manage permission.' })
  @ApiOperation({ summary: 'Soft-delete a process definition.' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @CurrentUser() actor: CurrentUserContext,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.deleteProcess.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      processId: id,
      actorUserId: actor.sub,
    });
    return { success: true };
  }

  @Post(':id/run')
  @RequirePermissions(RUN)
  @ApiForbiddenResponse({ description: 'Missing inventory:process:run permission.' })
  @ApiOperation({
    summary: 'Execute a production run (FIFO/FEFO input consumption + cost rollup).',
  })
  @ApiCreatedResponse({ type: ProcessRunResponse })
  async run(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @CurrentUser() actor: CurrentUserContext,
    @Param('id') id: string,
    @Body() dto: RunProcessDto,
  ): Promise<ProcessRunResponse> {
    const run = await this.runProcess.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      processId: id,
      multiplier: dto.multiplier,
      runAt: dto.runAt ? new Date(dto.runAt) : null,
      note: dto.note ?? null,
      outputExpiry: dto.outputExpiry?.map((e) => ({
        itemId: e.itemId,
        expiryDate: new Date(e.expiryDate),
      })),
      actorUserId: actor.sub,
    });
    return ProcessRunResponse.from(run);
  }
}
