import { Inject, Injectable } from '@nestjs/common';
import {
  BRANCH_ACCESS_RESOLVER,
  BranchAccessResolver,
} from '../../../../shared/auth/branch-access.resolver';
import { BranchAccessForbidden, NoRestaurantInScope } from '../application.errors';

export interface ResolveReportScopeInput {
  organizationId: string;
  restaurantId: string | null;
  userId: string;
  /** Optional single-branch filter (validated against the caller's reach). */
  requestedBranchId?: string | null;
}

export interface ReportScope {
  /** The branches to query (already access-checked). */
  branchIds: string[];
  /** branchId -> name, for roll-up labels. */
  branchNames: Map<string, string>;
  /** True if the caller has Owner all-branch reach (cross-branch roll-ups). */
  allBranches: boolean;
}

/**
 * Resolves the branch scope for an inventory report (6D), mirroring the audit
 * activity-log isolation: an all-branch (Owner) caller sees every active branch
 * (or a single requested one); a branch-explicit caller is restricted to the
 * branches they hold a membership for. A requested branch outside reach is 403.
 */
@Injectable()
export class InventoryReportScopeService {
  constructor(
    @Inject(BRANCH_ACCESS_RESOLVER) private readonly branchAccess: BranchAccessResolver,
  ) {}

  async resolve(input: ResolveReportScopeInput): Promise<ReportScope> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const access = await this.branchAccess.resolveAccessibleBranches({
      organizationId: input.organizationId,
      restaurantId: input.restaurantId,
      userId: input.userId,
    });
    const branchNames = new Map(access.branches.map((b) => [b.id, b.name]));

    if (input.requestedBranchId) {
      // A specific branch was requested — it must be within the caller's reach
      // (for an all-branch caller, `branches` is every active branch).
      if (!branchNames.has(input.requestedBranchId)) {
        throw BranchAccessForbidden();
      }
      return {
        branchIds: [input.requestedBranchId],
        branchNames,
        allBranches: access.allBranches,
      };
    }

    // Unfiltered: all-branch callers get every branch (the Owner roll-up);
    // branch-explicit callers get only the branches they can reach.
    return {
      branchIds: access.branches.map((b) => b.id),
      branchNames,
      allBranches: access.allBranches,
    };
  }
}
