import { Role as PrismaRole } from '@prisma/client';
import { Role } from '../../domain/entities/role';
import { PermissionKey } from '../../domain/permissions.catalog';

/** Maps between Prisma `roles` records and the Role domain aggregate. */
export class RoleMapper {
  static toDomain(record: PrismaRole): Role {
    return Role.reconstitute(record.id, {
      organizationId: record.organizationId,
      name: record.name,
      code: record.code,
      permissions: record.permissions as PermissionKey[],
      isSystem: record.isSystem,
      allBranches: record.allBranches,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toCreate(role: Role) {
    return {
      id: role.id,
      organizationId: role.organizationId,
      name: role.name,
      code: role.code,
      permissions: role.permissions,
      isSystem: role.isSystem,
      allBranches: role.allBranches,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  static toUpdate(role: Role) {
    return {
      name: role.name,
      permissions: role.permissions,
      updatedAt: role.updatedAt,
    };
  }
}
