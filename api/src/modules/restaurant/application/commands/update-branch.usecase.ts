import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { Branch, BranchIpBindingMode } from '../../domain/entities/branch';
import { BranchIpPolicyChangedEvent } from '../../domain/events/policy-events';
import { BRANCH_REPOSITORY, BranchRepository } from '../../domain/repositories/branch.repository';
import { BranchNotFound, NoRestaurantInScope } from '../application.errors';

export interface UpdateBranchInput {
  restaurantId: string | null;
  branchId: string;
  name?: string;
  ipBindingMode?: BranchIpBindingMode;
  ipAllowlist?: string[];
  actorUserId?: string | null;
  ip?: string | null;
}

/** Update a branch (rename + 3A IP policy), scoped to the tenant's restaurant. */
@Injectable()
export class UpdateBranchUseCase implements UseCase<UpdateBranchInput, Branch> {
  constructor(
    @Inject(BRANCH_REPOSITORY) private readonly branches: BranchRepository,
    private readonly events: DomainEventPublisher,
  ) {}

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
    const ipPolicyChanged = branch.updateIpPolicy(input.ipBindingMode, input.ipAllowlist);
    await this.branches.update(branch);

    // Audit only real IP-policy changes (a sensitive security control).
    if (ipPolicyChanged) {
      await this.events.publish(
        new BranchIpPolicyChangedEvent(
          branch.id,
          branch.restaurantId,
          input.actorUserId ?? null,
          branch.ipBindingMode,
          branch.ipAllowlist,
          input.ip ?? null,
        ),
      );
    }
    return branch;
  }
}
