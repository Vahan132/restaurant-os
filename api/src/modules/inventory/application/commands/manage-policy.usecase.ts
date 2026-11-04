import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { BranchInventoryPolicy } from '../../domain/entities/branch-inventory-policy';
import { NegativeStockMode } from '../../domain/enums';
import {
  BRANCH_INVENTORY_POLICY_REPOSITORY,
  BranchInventoryPolicyRepository,
} from '../../domain/repositories/branch-inventory-policy.repository';
import { NoRestaurantInScope } from '../application.errors';

interface BaseInput {
  restaurantId: string | null;
  branchId: string;
}

/** Read the branch negative-stock policy (defaults to WARN if unset). */
@Injectable()
export class GetBranchPolicyUseCase implements UseCase<BaseInput, BranchInventoryPolicy> {
  constructor(
    @Inject(BRANCH_INVENTORY_POLICY_REPOSITORY)
    private readonly repo: BranchInventoryPolicyRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: BaseInput): Promise<BranchInventoryPolicy> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const existing = await this.repo.find(input.restaurantId, input.branchId);
    return (
      existing ??
      BranchInventoryPolicy.create({
        id: this.ids.generate(),
        restaurantId: input.restaurantId,
        branchId: input.branchId,
      })
    );
  }
}

/** Update the branch negative-stock policy mode (ALLOW/WARN/BLOCK). */
@Injectable()
export class UpdateBranchPolicyUseCase
  implements UseCase<BaseInput & { mode: NegativeStockMode }, BranchInventoryPolicy>
{
  constructor(
    @Inject(BRANCH_INVENTORY_POLICY_REPOSITORY)
    private readonly repo: BranchInventoryPolicyRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: BaseInput & { mode: NegativeStockMode }): Promise<BranchInventoryPolicy> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const policy =
      (await this.repo.find(input.restaurantId, input.branchId)) ??
      BranchInventoryPolicy.create({
        id: this.ids.generate(),
        restaurantId: input.restaurantId,
        branchId: input.branchId,
      });
    policy.setMode(input.mode);
    await this.repo.upsert(policy);
    return policy;
  }
}
