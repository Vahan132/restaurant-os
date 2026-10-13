import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Branch } from '../../domain/entities/branch';
import { BRANCH_REPOSITORY, BranchRepository } from '../../domain/repositories/branch.repository';
import {
  BranchNotFound,
  CannotDefaultInactiveBranch,
  NoRestaurantInScope,
} from '../application.errors';

export interface MakeDefaultBranchInput {
  restaurantId: string | null;
  branchId: string;
}

/** Move the restaurant's default flag to a branch (atomic; still exactly one default). */
@Injectable()
export class MakeDefaultBranchUseCase implements UseCase<MakeDefaultBranchInput, Branch> {
  constructor(@Inject(BRANCH_REPOSITORY) private readonly branches: BranchRepository) {}

  async execute(input: MakeDefaultBranchInput): Promise<Branch> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const branch = await this.branches.findByIdInRestaurant(input.restaurantId, input.branchId);
    if (!branch) {
      throw BranchNotFound();
    }
    if (!branch.isActive()) {
      throw CannotDefaultInactiveBranch();
    }
    await this.branches.makeDefault(input.restaurantId, input.branchId);
    // Re-read so the response reflects the new default flag.
    const updated = await this.branches.findByIdInRestaurant(input.restaurantId, input.branchId);
    return updated ?? branch;
  }
}
