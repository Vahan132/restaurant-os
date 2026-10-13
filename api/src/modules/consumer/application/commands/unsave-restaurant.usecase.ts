import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  SAVED_RESTAURANT_REPOSITORY,
  SavedRestaurantRepository,
} from '../../domain/repositories/saved-restaurant.repository';
import { ConsumerActionAckResponse } from '../dto/booking-saved.dto';

export interface UnsaveRestaurantInput {
  customerAccountId: string;
  branchId: string;
}

/** Remove a saved branch (AUTH, idempotent — a no-op when nothing is saved). */
@Injectable()
export class UnsaveRestaurantUseCase
  implements UseCase<UnsaveRestaurantInput, ConsumerActionAckResponse>
{
  constructor(
    @Inject(SAVED_RESTAURANT_REPOSITORY) private readonly saved: SavedRestaurantRepository,
  ) {}

  async execute(input: UnsaveRestaurantInput): Promise<ConsumerActionAckResponse> {
    await this.saved.remove(input.customerAccountId, input.branchId);
    return { success: true };
  }
}
