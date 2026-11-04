import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  BranchStaffEntry,
  StaffDirectoryReader,
} from '../../application/ports/staff-directory.reader';

/**
 * Prisma-backed StaffDirectoryReader. Branch staff = users with an all-branch
 * role (display their restaurant-wide role) UNION users with a BranchMembership
 * at the branch (display their per-branch role). Only ACTIVE, non-deleted users.
 * Returns display fields only — never PIN data or hashes.
 */
@Injectable()
export class PrismaStaffDirectoryReader implements StaffDirectoryReader {
  constructor(private readonly prisma: PrismaService) {}

  async listBranchStaff(restaurantId: string, branchId: string): Promise<BranchStaffEntry[]> {
    const [allBranchUsers, memberships] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          restaurantId,
          deletedAt: null,
          status: 'ACTIVE',
          role: { allBranches: true },
        },
        select: { id: true, fullName: true, role: { select: { code: true, name: true } } },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.branchMembership.findMany({
        where: {
          branchId,
          restaurantId,
          user: { deletedAt: null, status: 'ACTIVE' },
        },
        select: {
          userId: true,
          user: { select: { fullName: true } },
          // The member's role AT THIS BRANCH (more meaningful than User.role,
          // which may be the BRANCH_SCOPED sentinel).
          roleId: true,
        },
      }),
    ]);

    const roleIds = Array.from(new Set(memberships.map((m) => m.roleId)));
    const roles = roleIds.length
      ? await this.prisma.role.findMany({
          where: { id: { in: roleIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const roleById = new Map(roles.map((r) => [r.id, r]));

    const byUser = new Map<string, BranchStaffEntry>();
    for (const u of allBranchUsers) {
      byUser.set(u.id, {
        id: u.id,
        fullName: u.fullName,
        roleCode: u.role?.code ?? null,
        roleName: u.role?.name ?? null,
      });
    }
    for (const m of memberships) {
      if (byUser.has(m.userId)) {
        continue;
      }
      const role = roleById.get(m.roleId);
      byUser.set(m.userId, {
        id: m.userId,
        fullName: m.user.fullName,
        roleCode: role?.code ?? null,
        roleName: role?.name ?? null,
      });
    }

    return Array.from(byUser.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
  }
}
