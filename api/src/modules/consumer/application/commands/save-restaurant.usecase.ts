import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  BRANCH_PUBLIC_REPOSITORY,
  BranchPublicRepository,
} from '../../domain/repositories/branch-public.repository';
import {
  SAVED_RESTAURANT_REPOSITORY,
  SavedRestaurantRepository,
} from '../../domain/repositories/saved-restaurant.repository';
import { BranchNotListedError } from '../../domain/consumer.errors';
import { ConsumerActionAckResponse } from '../dto/booking-saved.dto';

export interface SaveRestaurantInput {
  customerAccountId: string;
  branchId: string;
}

/**
 * Save a branch (AUTH, idempotent). Only effectively-listed branches can be saved
 * (CX-1 rule) → 404 BRANCH_NOT_LISTED otherwise. Re-saving is a no-op.
 */
@Injectable()
export class SaveRestaurantUseCase
  implements UseCase<SaveRestaurantInput, ConsumerActionAckResponse>
{
  constructor(
    @Inject(BRANCH_PUBLIC_REPOSITORY) private readonly branches: BranchPublicRepository,
    @Inject(SAVED_RESTAURANT_REPOSITORY) private readonly saved: SavedRestaurantRepository,
  ) {}

  async execute(input: SaveRestaurantInput): Promise<ConsumerActionAckResponse> {
    // loadAvailabilityContext returns null unless the branch is effectively listed.
    const listed = await this.branches.loadAvailabilityContext(input.branchId);
    if (!listed) {
      throw new BranchNotListedError();
    }
    await this.saved.save(input.customerAccountId, input.branchId);
    return { success: true };
  }
}
