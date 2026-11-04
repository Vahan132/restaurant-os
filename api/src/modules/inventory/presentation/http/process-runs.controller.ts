import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Paginated } from '../../../../shared/application/pagination';
import { ActiveBranchId } from '../../../../shared/auth/active-branch.decorator';
import { BranchScoped } from '../../../../shared/auth/branch-scoped.decorator';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { ListProcessRunsQuery } from '../../application/dto/process-run.dto';
import {
  ProcessRunDetailResponse,
  ProcessRunResponse,
} from '../../application/dto/process-responses';
import { GetProcessRunUseCase } from '../../application/queries/get-process-run.usecase';
import { ListProcessRunsUseCase } from '../../application/queries/list-process-runs.usecase';

const READ = PERMISSIONS.INVENTORY_READ;

@ApiTags('inventory-process-runs')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('inventory/process-runs')
export class ProcessRunsController {
  constructor(
    private readonly listRuns: ListProcessRunsUseCase,
    private readonly getRun: GetProcessRunUseCase,
  ) {}

  @Get()
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'List production runs (paginated; ?processId + date range).' })
  @ApiOkResponse({ type: [ProcessRunResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Query() query: ListProcessRunsQuery,
  ): Promise<Paginated<ProcessRunResponse>> {
    const page = await this.listRuns.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      processId: query.processId,
      runFrom: query.runFrom ? new Date(query.runFrom) : undefined,
      runTo: query.runTo ? new Date(query.runTo) : undefined,
      page: query.page,
      limit: query.limit,
    });
    return { data: page.data.map(ProcessRunResponse.from), pagination: page.pagination };
  }

  @Get(':id')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Get a run with consumed/produced movements + produced layers.' })
  @ApiOkResponse({ type: ProcessRunDetailResponse })
  async get(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Param('id') id: string,
  ): Promise<ProcessRunDetailResponse> {
    const { run, detail } = await this.getRun.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      runId: id,
    });
    return ProcessRunDetailResponse.fromDetail(run, detail);
  }
}
