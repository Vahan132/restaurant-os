import { Branch } from '../entities/branch';

export const BRANCH_REPOSITORY = Symbol('BranchRepository');

/** Tenant-scoped by restaurantId (branches belong to a restaurant). */
export interface BranchRepository {
  listByRestaurant(restaurantId: string): Promise<Branch[]>;
  findByIdInRestaurant(restaurantId: string, branchId: string): Promise<Branch | null>;
  /** The restaurant's current default branch (active, non-deleted), if any. */
  findDefault(restaurantId: string): Promise<Branch | null>;
  countActive(restaurantId: string): Promise<number>;
  /** BR-9: whether a slug is already taken within the restaurant (incl. soft-deleted). */
  existsBySlug(restaurantId: string, slug: string): Promise<boolean>;
  create(branch: Branch): Promise<void>;
  update(branch: Branch): Promise<void>;
  /**
   * Atomically move the default flag to `branchId` (clears any other default in
   * the same restaurant within one transaction → still exactly one default).
   */
  makeDefault(restaurantId: string, branchId: string): Promise<void>;
}
