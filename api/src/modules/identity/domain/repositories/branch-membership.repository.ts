import { BranchMembership } from '../entities/branch-membership';

/** DI token for the BranchMembershipRepository port. */
export const BRANCH_MEMBERSHIP_REPOSITORY = Symbol('BranchMembershipRepository');

/**
 * BranchMembershipRepository port (Prisma impl in infrastructure). A membership
 * is keyed by (branchId, userId) — one role per user per branch.
 */
export interface BranchMembershipRepository {
  /** The user's membership at a specific branch, if any. */
  findByUserAndBranch(userId: string, branchId: string): Promise<BranchMembership | null>;

  /** All of a user's memberships within a restaurant. */
  listByUser(restaurantId: string, userId: string): Promise<BranchMembership[]>;

  /** Insert or update (by branchId+userId) the user's role at a branch. */
  upsert(membership: BranchMembership): Promise<void>;

  /** Remove the user's membership at a branch (idempotent). */
  deleteByUserAndBranch(userId: string, branchId: string): Promise<void>;
}
