import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Branch } from '../../domain/entities/branch';
import { BRANCH_REPOSITORY, BranchRepository } from '../../domain/repositories/branch.repository';
import { NoRestaurantInScope } from '../application.errors';
import { RestaurantScope } from './get-restaurant-profile.usecase';

/** List branches for the tenant's restaurant. */
@Injectable()
export class ListBranchesUseCase implements UseCase<RestaurantScope, Branch[]> {
  constructor(@Inject(BRANCH_REPOSITORY) private readonly branches: BranchRepository) {}

  execute(input: RestaurantScope): Promise<Branch[]> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    return this.branches.listByRestaurant(input.restaurantId);
  }
}
