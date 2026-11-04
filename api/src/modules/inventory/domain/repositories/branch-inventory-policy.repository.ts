import { BranchInventoryPolicy } from '../entities/branch-inventory-policy';

export const BRANCH_INVENTORY_POLICY_REPOSITORY = Symbol('BranchInventoryPolicyRepository');

/** Per-branch negative-stock policy store (6A). One row per branch. */
export interface BranchInventoryPolicyRepository {
  find(restaurantId: string, branchId: string): Promise<BranchInventoryPolicy | null>;
  /** Create-or-update the single policy row for a branch. */
  upsert(policy: BranchInventoryPolicy): Promise<void>;
}
