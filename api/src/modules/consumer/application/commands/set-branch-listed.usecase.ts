import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  BRANCH_PUBLIC_REPOSITORY,
  BranchPublicRepository,
} from '../../domain/repositories/branch-public.repository';
import {
  RESTAURANT_MARKETING_REPOSITORY,
  RestaurantMarketingRepository,
} from '../../domain/repositories/restaurant-marketing.repository';
import { evaluateCompleteness } from '../../domain/completeness';
import { RestaurantProfileIncompleteError } from '../../domain/consumer.errors';

export interface SetBranchListedInput {
  branchId: string;
  value: boolean;
}

/**
 * SetBranchListed — set `listedInConsumerApp`. Setting FALSE is always allowed.
 * Setting TRUE runs the completeness gate (brand + branch); on failure throws
 * RESTAURANT_PROFILE_INCOMPLETE with the structured missing-field list.
 */
@Injectable()
export class SetBranchListedUseCase implements UseCase<SetBranchListedInput, void> {
  constructor(
    @Inject(BRANCH_PUBLIC_REPOSITORY)
    private readonly branches: BranchPublicRepository,
    @Inject(RESTAURANT_MARKETING_REPOSITORY)
    private readonly marketing: RestaurantMarketingRepository,
  ) {}

  async execute(input: SetBranchListedInput): Promise<void> {
    if (!input.value) {
      await this.branches.setListed(input.branchId, false);
      return;
    }

    const branch = await this.branches.loadState(input.branchId);
    if (!branch) {
      // Unknown branch — surface as an incomplete profile (nothing to list).
      throw new RestaurantProfileIncompleteError(['branch.address', 'branch.openingHours']);
    }
    const brand = await this.marketing.loadBrandSummary(branch.restaurantId);

    const missing = evaluateCompleteness({
      restaurantName: brand?.name,
      logoUrl: brand?.logoUrl,
      about: brand?.about ?? {},
      photoCount: brand?.photoCount ?? 0,
      branchAddress: branch.address,
      openHoursCount: branch.openHoursCount,
    });

    if (missing.length > 0) {
      throw new RestaurantProfileIncompleteError(missing);
    }

    await this.branches.setListed(input.branchId, true);
  }
}
