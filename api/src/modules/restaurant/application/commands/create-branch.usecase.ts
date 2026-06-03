import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { Branch } from '../../domain/entities/branch';
import { BRANCH_REPOSITORY, BranchRepository } from '../../domain/repositories/branch.repository';
import {
  RESTAURANT_REPOSITORY,
  RestaurantRepository,
} from '../../domain/repositories/restaurant.repository';
import {
  BranchLimitExceeded,
  NoRestaurantInScope,
  RestaurantNotFound,
} from '../application.errors';
import { PLAN_LIMITS_READER, PlanLimitsReader } from '../ports/plan-limits.reader';

export interface CreateBranchInput {
  organizationId: string;
  restaurantId: string | null;
  name: string;
}

/** Create a branch, enforcing the plan's maxBranchesPerRestaurant. */
@Injectable()
export class CreateBranchUseCase implements UseCase<CreateBranchInput, Branch> {
  constructor(
    @Inject(RESTAURANT_REPOSITORY) private readonly restaurants: RestaurantRepository,
    @Inject(BRANCH_REPOSITORY) private readonly branches: BranchRepository,
    @Inject(PLAN_LIMITS_READER) private readonly planLimits: PlanLimitsReader,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateBranchInput): Promise<Branch> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const restaurant = await this.restaurants.findByIdInOrg(
      input.organizationId,
      input.restaurantId,
    );
    if (!restaurant) {
      throw RestaurantNotFound();
    }

    const max = await this.planLimits.maxBranchesPerRestaurant(input.organizationId);
    if (max !== null) {
      const active = await this.branches.countActive(input.restaurantId);
      if (active + 1 > max) {
        throw BranchLimitExceeded(max);
      }
    }

    const branch = Branch.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      name: input.name,
    });
    await this.branches.create(branch);
    return branch;
  }
}
