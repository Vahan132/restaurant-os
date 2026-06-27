import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../domain/entities/role';
import { User } from '../../domain/entities/user';

export class UserResponse {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty({ nullable: true, type: String }) restaurantId!: string | null;
  @ApiProperty({ nullable: true, type: String }) branchId!: string | null;
  @ApiProperty() email!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ enum: ['ACTIVE', 'BLOCKED'] }) status!: string;
  @ApiProperty() roleId!: string;
  @ApiProperty({ nullable: true, type: String }) lastLoginAt!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static from(user: User): UserResponse {
    return {
      id: user.id,
      organizationId: user.organizationId,
      restaurantId: user.restaurantId,
      branchId: user.branchId,
      email: user.email.value,
      fullName: user.fullName,
      status: user.status,
      roleId: user.roleId,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}

export class RoleResponse {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() code!: string;
  @ApiProperty({ type: [String] }) permissions!: string[];
  @ApiProperty() isSystem!: boolean;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static from(role: Role): RoleResponse {
    return {
      id: role.id,
      organizationId: role.organizationId,
      name: role.name,
      code: role.code,
      permissions: role.permissions,
      isSystem: role.isSystem,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    };
  }
}

export class AuthTokensResponse {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ description: 'Access-token lifetime in seconds.' }) expiresIn!: number;
  @ApiProperty({ type: UserResponse }) user!: UserResponse;
}

/** A branch the caller can access, with their effective permissions there (BR-1). */
export class AccessibleBranchResponse {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isDefault!: boolean;
  @ApiProperty({ type: [String], description: 'Effective permissions at this branch.' })
  permissions!: string[];
}

export class MeResponse {
  @ApiProperty({ type: UserResponse }) user!: UserResponse;
  @ApiProperty({ type: RoleResponse, nullable: true }) role!: RoleResponse | null;
  @ApiProperty({ type: [String], description: 'Restaurant-wide permission set.' })
  permissions!: string[];

  @ApiProperty({
    description: 'True if the caller is restaurant-wide (their role applies at every branch).',
  })
  allBranches!: boolean;

  @ApiProperty({
    type: [AccessibleBranchResponse],
    description: 'Branches the caller can access, each with effective permissions.',
  })
  accessibleBranches!: AccessibleBranchResponse[];

  @ApiProperty({ nullable: true, type: String, description: "The caller's default branch id." })
  defaultBranchId!: string | null;
}

export class PermissionsResponse {
  @ApiProperty({ type: [String] }) permissions!: string[];
}
