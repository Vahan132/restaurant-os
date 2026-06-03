import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
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
import { CreateBranchUseCase } from '../../application/commands/create-branch.usecase';
import { DeactivateBranchUseCase } from '../../application/commands/deactivate-branch.usecase';
import { UpdateBranchUseCase } from '../../application/commands/update-branch.usecase';
import { CreateBranchDto, UpdateBranchDto } from '../../application/dto/branch.dto';
import { BranchResponse } from '../../application/dto/responses';
import { ListBranchesUseCase } from '../../application/queries/list-branches.usecase';

/** Tenant-scoped branch management. Writes require SETTINGS_MANAGE. */
@ApiTags('restaurant-branches')
@ApiBearerAuth('access-token')
@Controller('restaurant/branches')
export class BranchesController {
  constructor(
    private readonly listBranches: ListBranchesUseCase,
    private readonly createBranch: CreateBranchUseCase,
    private readonly updateBranch: UpdateBranchUseCase,
    private readonly deactivateBranch: DeactivateBranchUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List branches of the current restaurant.' })
  @ApiOkResponse({ type: [BranchResponse] })
  async list(@CurrentTenant() tenant: TenantContext): Promise<BranchResponse[]> {
    const branches = await this.listBranches.execute({
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
    });
    return branches.map(BranchResponse.from);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing SETTINGS_MANAGE permission.' })
  @ApiOperation({ summary: 'Create a branch (enforces plan limit).' })
  @ApiCreatedResponse({ type: BranchResponse })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateBranchDto,
  ): Promise<BranchResponse> {
    const branch = await this.createBranch.execute({
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
      name: dto.name,
    });
    return BranchResponse.from(branch);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing SETTINGS_MANAGE permission.' })
  @ApiOperation({ summary: 'Rename a branch.' })
  @ApiOkResponse({ type: BranchResponse })
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ): Promise<BranchResponse> {
    const branch = await this.updateBranch.execute({
      restaurantId: tenant.restaurantId,
      branchId: id,
      name: dto.name,
    });
    return BranchResponse.from(branch);
  }

  @Post(':id/deactivate')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing SETTINGS_MANAGE permission.' })
  @ApiOperation({ summary: 'Deactivate a branch.' })
  @ApiOkResponse({ type: BranchResponse })
  async deactivate(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<BranchResponse> {
    const branch = await this.deactivateBranch.execute({
      restaurantId: tenant.restaurantId,
      branchId: id,
    });
    return BranchResponse.from(branch);
  }
}
