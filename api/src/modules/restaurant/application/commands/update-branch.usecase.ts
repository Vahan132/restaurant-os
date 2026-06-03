import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Branch } from '../../domain/entities/branch';
import { BRANCH_REPOSITORY, BranchRepository } from '../../domain/repositories/branch.repository';
import { BranchNotFound, NoRestaurantInScope } from '../application.errors';

export interface UpdateBranchInput {
  restaurantId: string | null;
  branchId: string;
  name?: string;
}

/** Rename a branch (scoped to the tenant's restaurant). */
@Injectable()
export class UpdateBranchUseCase implements UseCase<UpdateBranchInput, Branch> {
  constructor(@Inject(BRANCH_REPOSITORY) private readonly branches: BranchRepository) {}

  async execute(input: UpdateBranchInput): Promise<Branch> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const branch = await this.branches.findByIdInRestaurant(input.restaurantId, input.branchId);
    if (!branch) {
      throw BranchNotFound();
    }
    if (input.name !== undefined) {
      branch.rename(input.name);
    }
    await this.branches.update(branch);
    return branch;
  }
}
