import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  BRANCH_ACCESS_RESOLVER,
  BranchAccessResolver,
} from '../../../shared/auth/branch-access.resolver';
import { NoRestaurantInScope } from './application.errors';

export const ReportBranchForbidden = () =>
  new ForbiddenException({
    code: 'BRANCH_ACCESS_FORBIDDEN',
    message: 'You do not have access to reports for the requested branch.',
  });

export interface ResolveReportBranchesInput {
  organizationId: string;
  restaurantId: string | null;
  userId: string;
  /** Optional single-branch filter (validated against the caller's reach). */
  requestedBranchId?: string | null;
  /** The report permission the caller must hold AT a branch to see its figures. */
  permission: string;
}

export interface ReportBranches {
  /** Branch ids to aggregate (already access-checked). Never empty on success. */
  branchIds: string[];
  /** branchId -> name (every branch the caller may report on). */
  branchNames: Map<string, string>;
  /** Name of the single requested branch, or null for an "all branches" roll-up. */
  selectedBranchName: string | null;
}

/**
 * BR-REPORTS-1: branch scope for the sales / profit reports.
 *
 * - Owner-style callers (restaurant-wide reach) may report on every branch, or
 *   narrow to one with `?branchId=`.
 * - Branch-scoped callers only see branches where they hold the report
 *   permission (e.g. a manager of Gyumri with reports:view sees Gyumri only).
 *   Unfiltered = the roll-up of exactly those branches; a branch outside that
 *   set is 403.
 */
@Injectable()
export class ReportBranchScopeService {
  constructor(
    @Inject(BRANCH_ACCESS_RESOLVER) private readonly branchAccess: BranchAccessResolver,
  ) {}

  async resolve(input: ResolveReportBranchesInput): Promise<ReportBranches> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const access = await this.branchAccess.resolveAccessibleBranches({
      organizationId: input.organizationId,
      restaurantId: input.restaurantId,
      userId: input.userId,
    });
    const allowed = access.branches.filter(
      (b) =>
        access.allBranches ||
        access.restaurantWidePermissions.includes(input.permission) ||
        b.permissions.includes(input.permission),
    );
    const branchNames = new Map(allowed.map((b) => [b.id, b.name]));

    if (input.requestedBranchId) {
      if (!branchNames.has(input.requestedBranchId)) {
        throw ReportBranchForbidden();
      }
      return {
        branchIds: [input.requestedBranchId],
        branchNames,
        selectedBranchName: branchNames.get(input.requestedBranchId) ?? null,
      };
    }
    if (allowed.length === 0) {
      throw ReportBranchForbidden();
    }
    return { branchIds: allowed.map((b) => b.id), branchNames, selectedBranchName: null };
  }
}
