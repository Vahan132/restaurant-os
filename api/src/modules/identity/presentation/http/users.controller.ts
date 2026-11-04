import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Paginated } from '../../../../shared/application/pagination';
import { PERMISSIONS } from '../../domain/permissions.catalog';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { BlockUserUseCase } from '../../application/commands/block-user.usecase';
import { ChangePasswordUseCase } from '../../application/commands/change-password.usecase';
import { CreateUserUseCase } from '../../application/commands/create-user.usecase';
import { UnblockUserUseCase } from '../../application/commands/unblock-user.usecase';
import { UpdateUserUseCase } from '../../application/commands/update-user.usecase';
import { ChangePasswordDto } from '../../application/dto/change-password.dto';
import { CreateUserDto } from '../../application/dto/create-user.dto';
import { ListUsersQuery } from '../../application/dto/list-users.query';
import { UserResponse } from '../../application/dto/responses';
import { UpdateUserDto } from '../../application/dto/update-user.dto';
import { GetUserUseCase } from '../../application/queries/get-user.usecase';
import { ListUsersUseCase } from '../../application/queries/list-users.usecase';

/**
 * User management. The whole controller requires USER_MANAGE; the organization
 * always comes from the tenant context (request.tenant), never from the body.
 */
@ApiTags('users')
@ApiBearerAuth('access-token')
@ApiForbiddenResponse({ description: 'Missing USER_MANAGE permission.' })
@RequirePermissions(PERMISSIONS.USER_MANAGE)
@Controller('users')
export class UsersController {
  constructor(
    private readonly createUser: CreateUserUseCase,
    private readonly updateUser: UpdateUserUseCase,
    private readonly blockUser: BlockUserUseCase,
    private readonly unblockUser: UnblockUserUseCase,
    private readonly changePassword: ChangePasswordUseCase,
    private readonly listUsers: ListUsersUseCase,
    private readonly getUser: GetUserUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a user in the current organization.' })
  @ApiCreatedResponse({ type: UserResponse })
  async create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: CurrentUserContext,
    @Body() dto: CreateUserDto,
  ): Promise<UserResponse> {
    const user = await this.createUser.execute({
      organizationId: tenant.organizationId, // tenant org — body org is never trusted
      email: dto.email,
      password: dto.password,
      fullName: dto.fullName,
      roleId: dto.roleId,
      restaurantId: dto.restaurantId ?? null,
      branchId: dto.branchId ?? null,
      actorUserId: actor.sub,
    });
    return UserResponse.from(user);
  }

  @Get()
  // IIKO-PERM-1: read-only staff access (iiko B_VE). Overrides the class-level
  // USER_MANAGE requirement for this read.
  @RequirePermissions(PERMISSIONS.USER_VIEW)
  @ApiOperation({ summary: 'List users (paginated, tenant-scoped).' })
  @ApiOkResponse({ type: [UserResponse] })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListUsersQuery,
  ): Promise<Paginated<UserResponse>> {
    const page = await this.listUsers.execute({
      organizationId: tenant.organizationId,
      page: query.page,
      limit: query.limit,
      restaurantId: query.restaurantId,
      search: query.search,
    });
    return { data: page.data.map(UserResponse.from), pagination: page.pagination };
  }

  @Get(':id')
  // IIKO-PERM-1: read-only staff access (iiko B_VE). Overrides the class-level
  // USER_MANAGE requirement for this read.
  @RequirePermissions(PERMISSIONS.USER_VIEW)
  @ApiOperation({ summary: 'Get a user by id.' })
  @ApiOkResponse({ type: UserResponse })
  async get(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<UserResponse> {
    const user = await this.getUser.execute({ organizationId: tenant.organizationId, userId: id });
    return UserResponse.from(user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user.' })
  @ApiOkResponse({ type: UserResponse })
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponse> {
    const user = await this.updateUser.execute({
      organizationId: tenant.organizationId,
      userId: id,
      fullName: dto.fullName,
      roleId: dto.roleId,
      restaurantId: dto.restaurantId,
      branchId: dto.branchId,
      scopeProvided: dto.restaurantId !== undefined || dto.branchId !== undefined,
    });
    return UserResponse.from(user);
  }

  @Post(':id/block')
  @HttpCode(200)
  @ApiOperation({ summary: 'Block a user.' })
  @ApiOkResponse({ type: UserResponse })
  async block(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: CurrentUserContext,
    @Param('id') id: string,
  ): Promise<UserResponse> {
    const user = await this.blockUser.execute({
      organizationId: tenant.organizationId,
      userId: id,
      actorUserId: actor.sub,
    });
    return UserResponse.from(user);
  }

  @Post(':id/unblock')
  @HttpCode(200)
  @ApiOperation({ summary: 'Unblock a user.' })
  @ApiOkResponse({ type: UserResponse })
  async unblock(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: CurrentUserContext,
    @Param('id') id: string,
  ): Promise<UserResponse> {
    const user = await this.unblockUser.execute({
      organizationId: tenant.organizationId,
      userId: id,
      actorUserId: actor.sub,
    });
    return UserResponse.from(user);
  }

  @Patch(':id/password')
  @ApiOperation({ summary: "Change a user's password (revokes their refresh tokens)." })
  @ApiOkResponse({ type: UserResponse })
  async setPassword(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<UserResponse> {
    const user = await this.changePassword.execute({
      organizationId: tenant.organizationId,
      userId: id,
      newPassword: dto.newPassword,
    });
    return UserResponse.from(user);
  }
}
