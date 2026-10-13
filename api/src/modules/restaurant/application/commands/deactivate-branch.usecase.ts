import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Branch } from '../../domain/entities/branch';
import { BRANCH_REPOSITORY, BranchRepository } from '../../domain/repositories/branch.repository';
import {
  BranchNotFound,
  CannotDisableDefaultBranch,
  CannotDisableLastBranch,
  NoRestaurantInScope,
} from '../application.errors';

export interface DeactivateBranchInput {
  restaurantId: string | null;
  branchId: string;
}

/**
 * Disable a branch (scoped to the tenant's restaurant). The default branch and
 * the last remaining active branch cannot be disabled (BR-1 invariant).
 */
@Injectable()
export class DeactivateBranchUseCase implements UseCase<DeactivateBranchInput, Branch> {
  constructor(@Inject(BRANCH_REPOSITORY) private readonly branches: BranchRepository) {}

  async execute(input: DeactivateBranchInput): Promise<Branch> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const branch = await this.branches.findByIdInRestaurant(input.restaurantId, input.branchId);
    if (!branch) {
      throw BranchNotFound();
    }
    if (branch.isDefault) {
      throw CannotDisableDefaultBranch();
    }
    // Only block when disabling an active branch would leave zero active branches.
    if (branch.isActive()) {
      const activeCount = await this.branches.countActive(input.restaurantId);
      if (activeCount <= 1) {
        throw CannotDisableLastBranch();
      }
    }
    branch.deactivate();
    await this.branches.update(branch);
    return branch;
  }
}
