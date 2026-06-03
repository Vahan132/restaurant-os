import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
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
import { TenantContext } from '../../../../shared/tenancy/tenant-context';
import { CreateRoleUseCase } from '../../application/commands/create-role.usecase';
import { DeleteRoleUseCase } from '../../application/commands/delete-role.usecase';
import { UpdateRoleUseCase } from '../../application/commands/update-role.usecase';
import { PermissionsResponse, RoleResponse } from '../../application/dto/responses';
import { CreateRoleDto, UpdateRoleDto } from '../../application/dto/role.dto';
import { GetPermissionsUseCase } from '../../application/queries/get-permissions.usecase';
import { ListRolesUseCase } from '../../application/queries/list-roles.usecase';
import { PERMISSIONS } from '../../domain/permissions.catalog';

/**
 * Roles + permission catalog. Reads require only authentication; writes require
 * ROLE_MANAGE. All operations are tenant-scoped via the tenant context.
 */
@ApiTags('roles')
@ApiBearerAuth('access-token')
@Controller()
export class RolesController {
  constructor(
    private readonly listRoles: ListRolesUseCase,
    private readonly createRole: CreateRoleUseCase,
    private readonly updateRole: UpdateRoleUseCase,
    private readonly deleteRole: DeleteRoleUseCase,
    private readonly getPermissions: GetPermissionsUseCase,
  ) {}

  @Get('roles')
  @ApiOperation({ summary: 'List all roles in the organization.' })
  @ApiOkResponse({ type: [RoleResponse] })
  async list(@CurrentTenant() tenant: TenantContext): Promise<RoleResponse[]> {
    const roles = await this.listRoles.execute({ organizationId: tenant.organizationId });
    return roles.map(RoleResponse.from);
  }

  @Post('roles')
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing ROLE_MANAGE permission.' })
  @ApiOperation({ summary: 'Create a custom role.' })
  @ApiCreatedResponse({ type: RoleResponse })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateRoleDto,
  ): Promise<RoleResponse> {
    const role = await this.createRole.execute({
      organizationId: tenant.organizationId,
      name: dto.name,
      code: dto.code,
      permissions: dto.permissions,
    });
    return RoleResponse.from(role);
  }

  @Patch('roles/:id')
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing ROLE_MANAGE permission.' })
  @ApiOperation({ summary: 'Update a role name/permissions.' })
  @ApiOkResponse({ type: RoleResponse })
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleResponse> {
    const role = await this.updateRole.execute({
      organizationId: tenant.organizationId,
      roleId: id,
      name: dto.name,
      permissions: dto.permissions,
    });
    return RoleResponse.from(role);
  }

  @Delete('roles/:id')
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  @HttpCode(200)
  @ApiForbiddenResponse({ description: 'Missing ROLE_MANAGE permission.' })
  @ApiOperation({ summary: 'Delete a non-system, unused role.' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.deleteRole.execute({ organizationId: tenant.organizationId, roleId: id });
    return { success: true };
  }

  @Get('permissions')
  @ApiOperation({ summary: 'Return the full permission catalog.' })
  @ApiOkResponse({ type: PermissionsResponse })
  permissions(): PermissionsResponse {
    return { permissions: this.getPermissions.execute() };
  }
}
