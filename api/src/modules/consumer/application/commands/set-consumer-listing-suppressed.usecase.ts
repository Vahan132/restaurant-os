import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  RESTAURANT_MARKETING_REPOSITORY,
  RestaurantMarketingRepository,
} from '../../domain/repositories/restaurant-marketing.repository';

export interface SetConsumerListingSuppressedInput {
  restaurantId: string;
  value: boolean;
}

/**
 * SetConsumerListingSuppressed (CX-ADMIN, PLATFORM-scoped) — the brand kill
 * switch. When true, every branch of the restaurant disappears from the consumer
 * public API regardless of the owner's `listedInConsumerApp` (effective listing =
 * listedInConsumerApp && !consumerListingSuppressed).
 */
@Injectable()
export class SetConsumerListingSuppressedUseCase
  implements UseCase<SetConsumerListingSuppressedInput, void>
{
  constructor(
    @Inject(RESTAURANT_MARKETING_REPOSITORY)
    private readonly marketing: RestaurantMarketingRepository,
  ) {}

  async execute(input: SetConsumerListingSuppressedInput): Promise<void> {
    const current = await this.marketing.loadConsumerListingSuppressed(input.restaurantId);
    if (current === null) {
      throw new NotFoundException({
        code: 'RESTAURANT_NOT_FOUND',
        message: 'Restaurant not found.',
      });
    }
    await this.marketing.setConsumerListingSuppressed(input.restaurantId, input.value);
  }
}
