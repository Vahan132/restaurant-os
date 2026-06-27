import { Inject, Injectable } from '@nestjs/common';
import {
  AccessibleBranch,
  AccessibleBranchesQuery,
  AccessibleBranchesResult,
  BranchAccessQuery,
  BranchAccessResolver,
  BranchAccessResult,
  DefaultBranchAccess,
} from '../../../../shared/auth/branch-access.resolver';
import { hasAllBranches, isRestaurantWideRole } from '../../domain/permissions.catalog';
import { ROLE_REPOSITORY, RoleRepository } from '../../domain/repositories/role.repository';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import {
  BRANCH_MEMBERSHIP_REPOSITORY,
  BranchMembershipRepository,
} from '../../domain/repositories/branch-membership.repository';
import { BRANCH_DIRECTORY_READER, BranchDirectoryReader } from '../ports/branch-directory.reader';

/**
 * EffectiveBranchAccessService (BR-1, revised by FIX-BR-1) — bound to the shared
 * BRANCH_ACCESS_RESOLVER token. Resolves a caller's access + effective
 * permissions at a branch.
 *
 * Two independent dimensions (FIX-BR-1 + FIX-E):
 *   - restaurant-wide PERMISSIONS = role.code !== BRANCH_SCOPED (branch/user/
 *     settings mgmt, reports) — resolved at the restaurant level, not here.
 *   - ALL-BRANCH reach = role.allBranches (a CAPABILITY; only OWNER by default).
 *
 * So for branch access:
 *   - all-branch role (owner): access to EVERY active branch in the restaurant
 *     with the user's own permission set (∪ any per-branch membership), no
 *     membership required.
 *   - everyone else: access ONLY to branches they hold a BranchMembership for,
 *     with that membership role's permissions (FIX-BR-1).
 *
 * The result `allBranches` flag reflects the real all-branch capability.
 */
@Injectable()
export class EffectiveBranchAccessService implements BranchAccessResolver {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(BRANCH_MEMBERSHIP_REPOSITORY)
    private readonly memberships: BranchMembershipRepository,
    @Inject(BRANCH_DIRECTORY_READER) private readonly branches: BranchDirectoryReader,
  ) {}

  async resolveForBranch(query: BranchAccessQuery): Promise<BranchAccessResult> {
    const { organizationId, restaurantId, userId, branchId } = query;

    const branch = await this.branches.findActive(restaurantId, branchId);
    if (!branch) {
      return { branchExists: false, hasAccess: false, permissions: [] };
    }

    const user = await this.users.findById(organizationId, userId);
    const role = user ? await this.roles.findById(organizationId, user.roleId) : null;
    const allBranch = hasAllBranches(role);
    const membership = await this.memberships.findByUserAndBranch(userId, branchId);

    // FIX-E: an all-branch role (owner) reaches ANY active branch in its
    // restaurant with its own permission set (∪ a membership's, if present) —
    // no membership required.
    if (allBranch) {
      const branchPerms = membership
        ? await this.permissionsOfRole(organizationId, membership.roleId)
        : [];
      return {
        branchExists: true,
        hasAccess: true,
        permissions: this.union(role?.permissions ?? [], branchPerms),
      };
    }

    // Everyone else (FIX-BR-1): access ONLY via an explicit BranchMembership.
    if (!membership) {
      return { branchExists: true, hasAccess: false, permissions: [] };
    }
    return {
      branchExists: true,
      hasAccess: true,
      permissions: await this.permissionsOfRole(organizationId, membership.roleId),
    };
  }

  async resolveAccessibleBranches(
    query: AccessibleBranchesQuery,
  ): Promise<AccessibleBranchesResult> {
    const { organizationId, restaurantId, userId } = query;

    const user = await this.users.findById(organizationId, userId);
    const role = user ? await this.roles.findById(organizationId, user.roleId) : null;
    const allBranch = hasAllBranches(role);
    const rolePerms = role?.permissions ?? [];
    const restaurantWide = isRestaurantWideRole(role?.code);
    const restaurantWidePerms = restaurantWide ? rolePerms : [];

    const [activeBranches, defaultBranch, memberships] = await Promise.all([
      this.branches.listActive(restaurantId),
      this.branches.findDefault(restaurantId),
      this.memberships.listByUser(restaurantId, userId),
    ]);
    const membershipByBranch = new Map(memberships.map((m) => [m.branchId, m]));

    if (allBranch) {
      // FIX-E: ALL active branches, each with the user's own permission set
      // (∪ any per-branch membership). Default = the restaurant's default branch.
      const branches: AccessibleBranch[] = [];
      for (const b of activeBranches) {
        const membership = membershipByBranch.get(b.id);
        const branchPerms = membership
          ? await this.permissionsOfRole(organizationId, membership.roleId)
          : [];
        branches.push({
          id: b.id,
          name: b.name,
          isDefault: b.isDefault,
          permissions: this.union(rolePerms, branchPerms),
        });
      }
      return {
        allBranches: true,
        restaurantWidePermissions: restaurantWidePerms,
        branches,
        defaultBranchId: defaultBranch?.id ?? activeBranches[0]?.id ?? null,
      };
    }

    // Branch-scoped (FIX-BR-1): ONLY the active branches the user holds a
    // BranchMembership for, with that membership role's permissions.
    const branches: AccessibleBranch[] = [];
    for (const b of activeBranches) {
      const membership = membershipByBranch.get(b.id);
      if (!membership) {
        continue;
      }
      branches.push({
        id: b.id,
        name: b.name,
        isDefault: b.isDefault,
        permissions: await this.permissionsOfRole(organizationId, membership.roleId),
      });
    }
    const defaultBranchId =
      defaultBranch && membershipByBranch.has(defaultBranch.id)
        ? defaultBranch.id
        : (branches[0]?.id ?? null);

    return {
      allBranches: false,
      restaurantWidePermissions: restaurantWidePerms,
      branches,
      defaultBranchId,
    };
  }

  async resolveDefaultBranchAccess(
    query: AccessibleBranchesQuery,
  ): Promise<DefaultBranchAccess | null> {
    const accessible = await this.resolveAccessibleBranches(query);
    if (!accessible.defaultBranchId) {
      return null;
    }
    const branch = accessible.branches.find((b) => b.id === accessible.defaultBranchId);
    return {
      branchId: accessible.defaultBranchId,
      permissions: branch?.permissions ?? accessible.restaurantWidePermissions,
    };
  }

  private async permissionsOfRole(organizationId: string, roleId: string): Promise<string[]> {
    const role = await this.roles.findById(organizationId, roleId);
    return role?.permissions ?? [];
  }

  private union(a: readonly string[], b: readonly string[]): string[] {
    return [...new Set([...a, ...b])];
  }
}
