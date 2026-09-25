import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../domain/permissions.catalog';
import { RemoveBranchMembershipUseCase } from '../../application/commands/remove-branch-membership.usecase';
import { UpsertBranchMembershipUseCase } from '../../application/commands/upsert-branch-membership.usecase';
import {
  BranchMembershipResponse,
  UpsertBranchMembershipDto,
} from '../../application/dto/branch-membership.dto';
import { ListBranchMembershipsUseCase } from '../../application/queries/list-branch-memberships.usecase';

/**
 * Branch-membership management (BR-1). Requires USER_MANAGE (restaurant-scoped).
 * The organization + restaurant always come from the tenant context, never the
 * body. A user may be all-branch (a non-sentinel restaurant-level role) OR
 * branch-scoped (the BRANCH_SCOPED sentinel role + these memberships).
 */
@ApiTags('users')
@ApiBearerAuth('access-token')
@ApiForbiddenResponse({ description: 'Missing USER_MANAGE permission.' })
@RequirePermissions(PERMISSIONS.USER_MANAGE)
@Controller('users')
export class BranchMembershipsController {
  constructor(
    private readonly upsertMembership: UpsertBranchMembershipUseCase,
    private readonly removeMembership: RemoveBranchMembershipUseCase,
    private readonly listMemberships: ListBranchMembershipsUseCase,
  ) {}

  @Get(':id/branch-memberships')
  // IIKO-PERM-1: read-only staff access (iiko B_VE). Overrides the class-level
  // USER_MANAGE requirement for this read.
  @RequirePermissions(PERMISSIONS.USER_VIEW)
  @ApiOperation({ summary: "List a user's branch memberships." })
  @ApiOkResponse({ type: [BranchMembershipResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<BranchMembershipResponse[]> {
    const views = await this.listMemberships.execute({
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
      userId: id,
    });
    return views.map(BranchMembershipResponse.fromView);
  }

  @Post(':id/branch-memberships')
  @ApiOperation({ summary: "Grant or change a user's role at a branch." })
  @ApiCreatedResponse({ type: BranchMembershipResponse })
  async upsert(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: CurrentUserContext,
    @Param('id') id: string,
    @Body() dto: UpsertBranchMembershipDto,
  ): Promise<BranchMembershipResponse> {
    const membership = await this.upsertMembership.execute({
      organizationId: tenant.organizationId,
      restaurantId: tenant.restaurantId,
      userId: id,
      branchId: dto.branchId,
      roleId: dto.roleId,
      actorUserId: actor.sub,
    });
    return BranchMembershipResponse.fromEntity(membership);
  }

  @Delete(':id/branch-memberships/:branchId')
  @HttpCode(200)
  @ApiOperation({ summary: "Revoke a user's role at a branch." })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('branchId') branchId: string,
  ): Promise<{ success: true }> {
    await this.removeMembership.execute({
      organizationId: tenant.organizationId,
      userId: id,
      branchId,
    });
    return { success: true };
  }
}
