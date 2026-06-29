import { Inject, Injectable } from '@nestjs/common';
import {
  BRANCH_ACCESS_RESOLVER,
  BranchAccessResolver,
} from '../../../../shared/auth/branch-access.resolver';
import { AuditLogQueryFilter } from '../../domain/repositories/audit-log.repository';
import {
  BranchAccessForbidden,
  InvalidDateRange,
  NoRestaurantInScope,
} from '../application.errors';

/** Raw, caller-supplied filter request (pre-validation, pre-scope-resolution). */
export interface AuditFilterRequest {
  organizationId: string;
  restaurantId: string | null;
  userId: string;
  from?: Date;
  to?: Date;
  action?: string;
  role?: string;
  branchId?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
}

/**
 * The SINGLE place that turns a raw filter request into the canonical
 * {@link AuditLogQueryFilter}. Both the list view and the export depend on it so
 * identical inputs always produce identical query criteria.
 *
 * Responsibilities:
 *   - require a restaurant scope,
 *   - validate the date range (`from` <= `to`),
 *   - enforce branch isolation: all-branch callers (e.g. OWNER) may read every
 *     branch; everyone else is restricted to the branches they can reach, and a
 *     `branchId` filter outside that reach is rejected.
 * (Enum-like validation of `action`/`role` happens at the DTO via @IsIn.)
 */
@Injectable()
export class AuditQueryService {
  constructor(
    @Inject(BRANCH_ACCESS_RESOLVER) private readonly branchAccess: BranchAccessResolver,
  ) {}

  async resolveFilter(req: AuditFilterRequest): Promise<AuditLogQueryFilter> {
    if (!req.restaurantId) {
      throw NoRestaurantInScope();
    }
    if (req.from && req.to && req.from.getTime() > req.to.getTime()) {
      throw InvalidDateRange();
    }

    const filter: AuditLogQueryFilter = {
      restaurantId: req.restaurantId,
      from: req.from,
      to: req.to,
      action: req.action,
      actorRoleCode: req.role,
      actorId: req.actorId,
      entityType: req.entityType,
      entityId: req.entityId,
    };

    const access = await this.branchAccess.resolveAccessibleBranches({
      organizationId: req.organizationId,
      restaurantId: req.restaurantId,
      userId: req.userId,
    });

    if (access.allBranches) {
      // All-branch reach (OWNER): may read any branch, or all when unfiltered.
      if (req.branchId) {
        filter.branchId = req.branchId;
      }
    } else {
      // Branch-explicit caller: restricted to branches they can reach.
      const accessibleIds = access.branches.map((b) => b.id);
      if (req.branchId) {
        if (!accessibleIds.includes(req.branchId)) {
          throw BranchAccessForbidden();
        }
        filter.branchId = req.branchId;
      } else {
        // Empty set => reaches no branch => no rows (isolation holds).
        filter.branchIdIn = accessibleIds;
      }
    }

    return filter;
  }
}
