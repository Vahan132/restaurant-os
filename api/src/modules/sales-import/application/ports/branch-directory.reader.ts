/** DI token for the BranchDirectoryReader port. */
export const BRANCH_DIRECTORY_READER = Symbol('BranchDirectoryReader');

/** Minimal branch projection used to resolve a CSV `branch` cell → branchId. */
export interface BranchDirectoryEntry {
  id: string;
  name: string;
}

/**
 * Read port: lists the (active, non-deleted) branches of a restaurant so the
 * importer can resolve each row's branch by id or by name. Implemented in
 * infrastructure with PrismaService.
 */
export interface BranchDirectoryReader {
  listBranches(restaurantId: string): Promise<BranchDirectoryEntry[]>;
}
