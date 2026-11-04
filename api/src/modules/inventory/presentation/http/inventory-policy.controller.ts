import { Body, Controller, Get, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
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
  GetBranchPolicyUseCase,
  UpdateBranchPolicyUseCase,
} from '../../application/commands/manage-policy.usecase';
import { UpdateBranchPolicyDto } from '../../application/dto/location.dto';
import { BranchInventoryPolicyResponse } from '../../application/dto/location-responses';

const READ = PERMISSIONS.INVENTORY_READ;
const MANAGE = PERMISSIONS.INVENTORY_POLICY_MANAGE;

@ApiTags('inventory-policy')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('inventory/policy')
export class InventoryPolicyController {
  constructor(
    private readonly getPolicy: GetBranchPolicyUseCase,
    private readonly updatePolicy: UpdateBranchPolicyUseCase,
  ) {}

  @Get()
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'Get the branch negative-stock policy.' })
  @ApiOkResponse({ type: BranchInventoryPolicyResponse })
  async get(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
  ): Promise<BranchInventoryPolicyResponse> {
    const policy = await this.getPolicy.execute({ restaurantId: tenant.restaurantId, branchId });
    return BranchInventoryPolicyResponse.from(policy);
  }

  @Put()
  @RequirePermissions(MANAGE)
  @ApiForbiddenResponse({ description: 'Missing inventory:policy:manage permission.' })
  @ApiOperation({ summary: 'Set the branch negative-stock mode (ALLOW/WARN/BLOCK).' })
  @ApiOkResponse({ type: BranchInventoryPolicyResponse })
  async update(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() branchId: string,
    @Body() dto: UpdateBranchPolicyDto,
  ): Promise<BranchInventoryPolicyResponse> {
    const policy = await this.updatePolicy.execute({
      restaurantId: tenant.restaurantId,
      branchId,
      mode: dto.negativeStockMode,
    });
    return BranchInventoryPolicyResponse.from(policy);
  }
}
