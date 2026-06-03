import { Branch } from '../entities/branch';

export const BRANCH_REPOSITORY = Symbol('BranchRepository');

/** Tenant-scoped by restaurantId (branches belong to a restaurant). */
export interface BranchRepository {
  listByRestaurant(restaurantId: string): Promise<Branch[]>;
  findByIdInRestaurant(restaurantId: string, branchId: string): Promise<Branch | null>;
  countActive(restaurantId: string): Promise<number>;
  create(branch: Branch): Promise<void>;
  update(branch: Branch): Promise<void>;
}
