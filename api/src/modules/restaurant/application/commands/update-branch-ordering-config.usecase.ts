import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Branch } from '../../domain/entities/branch';
import { OrderingConfigProps } from '../../domain/value-objects/ordering-config';
import { BRANCH_REPOSITORY, BranchRepository } from '../../domain/repositories/branch.repository';
import { BranchNotFound, NoRestaurantInScope } from '../application.errors';

export interface UpdateBranchOrderingConfigInput {
  restaurantId: string | null;
  branchId: string;
  prepaymentEnabled?: boolean;
  payAtEndEnabled?: boolean;
  qrOrderingEnabled?: boolean;
  idleExpiryMinutes?: number;
}

/**
 * ORDER-1: set a branch's ordering flow config. The OrderingConfig VO validates
 * its own invariants (≥1 flow when ordering on; qrOrdering ⇒ prepayment; idle
 * bounds). The restaurant ceiling is applied separately at session start.
 */
@Injectable()
export class UpdateBranchOrderingConfigUseCase
  implements UseCase<UpdateBranchOrderingConfigInput, Branch>
{
  constructor(@Inject(BRANCH_REPOSITORY) private readonly branches: BranchRepository) {}

  async execute(input: UpdateBranchOrderingConfigInput): Promise<Branch> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const branch = await this.branches.findByIdInRestaurant(input.restaurantId, input.branchId);
    if (!branch) {
      throw BranchNotFound();
    }
    const patch: Partial<OrderingConfigProps> = {};
    if (input.prepaymentEnabled !== undefined) patch.prepaymentEnabled = input.prepaymentEnabled;
    if (input.payAtEndEnabled !== undefined) patch.payAtEndEnabled = input.payAtEndEnabled;
    if (input.qrOrderingEnabled !== undefined) patch.qrOrderingEnabled = input.qrOrderingEnabled;
    if (input.idleExpiryMinutes !== undefined) patch.idleExpiryMinutes = input.idleExpiryMinutes;

    // .with() validates the resulting config (throws InvalidOrderingConfigError).
    const next = branch.orderingConfig.with(patch);
    branch.updateOrderingConfig(next);
    await this.branches.update(branch);
    return branch;
  }
}
