import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Branch } from '../../domain/entities/branch';
import { BRANCH_REPOSITORY, BranchRepository } from '../../domain/repositories/branch.repository';
import { BranchNotFound, NoRestaurantInScope } from '../application.errors';

export interface GetBranchInput {
  restaurantId: string | null;
  branchId: string;
}

/** Fetch a single branch within the tenant's restaurant. */
@Injectable()
export class GetBranchUseCase implements UseCase<GetBranchInput, Branch> {
  constructor(@Inject(BRANCH_REPOSITORY) private readonly branches: BranchRepository) {}

  async execute(input: GetBranchInput): Promise<Branch> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const branch = await this.branches.findByIdInRestaurant(input.restaurantId, input.branchId);
    if (!branch) {
      throw BranchNotFound();
    }
    return branch;
  }
}
