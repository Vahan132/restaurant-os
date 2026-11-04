import { BranchMembership as PrismaBranchMembership } from '@prisma/client';
import { BranchMembership } from '../../domain/entities/branch-membership';

/** Maps between Prisma `branch_memberships` records and the domain aggregate. */
export class BranchMembershipMapper {
  static toDomain(record: PrismaBranchMembership): BranchMembership {
    return BranchMembership.reconstitute(record.id, {
      restaurantId: record.restaurantId,
      branchId: record.branchId,
      userId: record.userId,
      roleId: record.roleId,
      createdByUserId: record.createdByUserId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
