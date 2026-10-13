import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { snapshotPermissionsForRole } from '../../../identity/domain/permissions.catalog';
import { UserPermissionReader } from '../../application/ports/user-permission.reader';

/** Checks whether a user (in an org) holds a permission, via their role. */
@Injectable()
export class PrismaUserPermissionReader implements UserPermissionReader {
  constructor(private readonly prisma: PrismaService) {}

  async userHasPermission(
    organizationId: string,
    userId: string,
    permission: string,
  ): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId, deletedAt: null, status: 'ACTIVE' },
      select: { roleId: true },
    });
    if (!user) {
      return false;
    }
    const role = await this.prisma.role.findFirst({
      where: { id: user.roleId, organizationId },
      select: { permissions: true, code: true, isSystem: true },
    });
    return snapshotPermissionsForRole(role).includes(permission);
  }
}
