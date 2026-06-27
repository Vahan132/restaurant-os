import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ActiveBranchId } from '../../../../shared/auth/active-branch.decorator';
import { BranchScoped } from '../../../../shared/auth/branch-scoped.decorator';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { CreateBranchUseCase } from '../../application/commands/create-branch.usecase';
import { DeactivateBranchUseCase } from '../../application/commands/deactivate-branch.usecase';
import { MakeDefaultBranchUseCase } from '../../application/commands/make-default-branch.usecase';
import { UpdateBranchUseCase } from '../../application/commands/update-branch.usecase';
import { CreateBranchDto, UpdateBranchDto } from '../../application/dto/branch.dto';
import { BranchResponse, MyBranchAccessResponse } from '../../application/dto/responses';
import { GetBranchUseCase } from '../../application/queries/get-branch.usecase';
import { GetMyBranchAccessUseCase } from '../../application/queries/get-my-branch-access.usecase';
import { ListBranchesUseCase } from '../../application/queries/list-branches.usecase';

/**
 * Branch management (BR-1). Restaurant-scoped: writes require BRANCH_MANAGE,
 * checked against the restaurant-wide role snapshot. The demonstration endpoint
 * GET /branches/:id/my-access is @BranchScoped and proves effective-permission
 * resolution at the active branch (X-Branch-Id).
 */
@ApiTags('branches')
@ApiBearerAuth('access-token')
@Controller('branches')
export class BranchesController {
  constructor(
    private readonly listBranches: ListBranchesUseCase,
    private readonly getBranch: GetBranchUseCase,
    private readonly createBranch: CreateBranchUseCase,
    private readonly updateBranch: UpdateBranchUseCase,
    private readonly deactivateBranch: DeactivateBranchUseCase,
    private readonly makeDefaultBranch: MakeDefaultBranchUseCase,
    private readonly getMyBranchAccess: GetMyBranchAccessUseCase,
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

  @Get(':id/my-access')
  @BranchScoped()
  @ApiParam({ name: 'id', description: 'Branch id (the active branch is taken from X-Branch-Id).' })
  @ApiOperation({
    summary: 'Effective permissions of the caller at the active branch (X-Branch-Id).',
  })
  @ApiForbiddenResponse({ description: 'No access to the active branch (BRANCH_ACCESS_DENIED).' })
  @ApiOkResponse({ type: MyBranchAccessResponse })
  async myAccess(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Param('id') _id: string,
    @ActiveBranchId() branchId: string,
  ): Promise<MyBranchAccessResponse> {
    return this.getMyBranchAccess.execute({
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
      userId: user.sub,
      branchId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a branch by id.' })
  @ApiOkResponse({ type: BranchResponse })
  async get(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<BranchResponse> {
    const branch = await this.getBranch.execute({
      restaurantId: tenant.restaurantId,
      branchId: id,
    });
    return BranchResponse.from(branch);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.BRANCH_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing BRANCH_MANAGE permission.' })
  @ApiOperation({ summary: 'Create a branch (enforces plan limit).' })
  @ApiCreatedResponse({ type: BranchResponse })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Body() dto: CreateBranchDto,
  ): Promise<BranchResponse> {
    const branch = await this.createBranch.execute({
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
      name: dto.name,
      actorUserId: user.sub,
    });
    return BranchResponse.from(branch);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.BRANCH_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing BRANCH_MANAGE permission.' })
  @ApiOperation({ summary: 'Update a branch.' })
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

  @Post(':id/disable')
  @RequirePermissions(PERMISSIONS.BRANCH_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing BRANCH_MANAGE permission.' })
  @ApiOperation({ summary: 'Disable a branch (not the default or last active branch).' })
  @ApiOkResponse({ type: BranchResponse })
  async disable(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<BranchResponse> {
    const branch = await this.deactivateBranch.execute({
      restaurantId: tenant.restaurantId,
      branchId: id,
    });
    return BranchResponse.from(branch);
  }

  @Post(':id/make-default')
  @RequirePermissions(PERMISSIONS.BRANCH_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing BRANCH_MANAGE permission.' })
  @ApiOperation({ summary: 'Make this the default branch (atomic; still exactly one default).' })
  @ApiOkResponse({ type: BranchResponse })
  async makeDefault(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<BranchResponse> {
    const branch = await this.makeDefaultBranch.execute({
      restaurantId: tenant.restaurantId,
      branchId: id,
    });
    return BranchResponse.from(branch);
  }
}
