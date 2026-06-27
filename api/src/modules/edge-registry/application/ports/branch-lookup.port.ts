export const BRANCH_LOOKUP = Symbol('EdgeBranchLookup');

/** Minimal branch existence check (the node's branch must belong to the restaurant). */
export interface BranchLookup {
  existsActive(restaurantId: string, branchId: string): Promise<boolean>;
}
