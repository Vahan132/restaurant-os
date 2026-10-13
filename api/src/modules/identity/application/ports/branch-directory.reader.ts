/** DI token for the BranchDirectoryReader port. */
export const BRANCH_DIRECTORY_READER = Symbol('BranchDirectoryReader');

export interface BranchDirectoryEntry {
  id: string;
  name: string;
  isDefault: boolean;
}

/**
 * Read-only view of the `branches` table for the identity module's branch-access
 * resolution. Implemented via Prisma in identity infrastructure so identity does
 * NOT have to import the restaurant module. Only ACTIVE, non-deleted branches.
 */
export interface BranchDirectoryReader {
  /** All active branches of a restaurant (ordered by creation). */
  listActive(restaurantId: string): Promise<BranchDirectoryEntry[]>;

  /** A single active branch within a restaurant, or null. */
  findActive(restaurantId: string, branchId: string): Promise<BranchDirectoryEntry | null>;

  /** The restaurant's default active branch, or null. */
  findDefault(restaurantId: string): Promise<BranchDirectoryEntry | null>;
}
