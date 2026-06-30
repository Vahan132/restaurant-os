import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  BRANCH_PUBLIC_REPOSITORY,
  BranchPublicRepository,
  PublicHoursRecord,
} from '../../domain/repositories/branch-public.repository';
import {
  RESTAURANT_MARKETING_REPOSITORY,
  RestaurantMarketingRepository,
} from '../../domain/repositories/restaurant-marketing.repository';
import { evaluateCompleteness, MissingField } from '../../domain/completeness';

export interface GetOwnerBranchListingInput {
  branchId: string;
}

export interface OwnerBranchListing {
  branchId: string;
  restaurantId: string;
  publicPhone: string | null;
  address: string | null;
  city: string | null;
  menuPublic: boolean;
  reservationsPublic: boolean;
  listedInConsumerApp: boolean;
  /** Platform kill switch on the parent restaurant (read-only display). */
  consumerListingSuppressed: boolean;
  /** listedInConsumerApp && !consumerListingSuppressed — what the owner toggle yields. */
  effectiveListed: boolean;
  weeklyHours: PublicHoursRecord[];
  /** FULL gate (brand + branch) — what gates listing THIS branch. */
  completeness: { isComplete: boolean; missing: MissingField[] };
}

/**
 * GetOwnerBranchListing — the branch-level editor read (CX-ADMIN). Returns the
 * branch public contact/hours, the three visibility flags, effective-listing
 * (incl. the kill switch), and the FULL completeness gate result so the UI can
 * show exactly what is missing before the owner toggles `listed`. Returns the
 * config regardless of listed state. Branch access is validated by the caller.
 */
@Injectable()
export class GetOwnerBranchListingUseCase
  implements UseCase<GetOwnerBranchListingInput, OwnerBranchListing>
{
  constructor(
    @Inject(BRANCH_PUBLIC_REPOSITORY)
    private readonly branches: BranchPublicRepository,
    @Inject(RESTAURANT_MARKETING_REPOSITORY)
    private readonly marketing: RestaurantMarketingRepository,
  ) {}

  async execute(input: GetOwnerBranchListingInput): Promise<OwnerBranchListing> {
    const state = await this.branches.loadState(input.branchId);
    if (!state) {
      throw new NotFoundException({
        code: 'BRANCH_NOT_FOUND',
        message: 'Branch not found in your restaurant.',
      });
    }
    const [weeklyHours, brand] = await Promise.all([
      this.branches.listPublicHours(input.branchId),
      this.marketing.loadBrandSummary(state.restaurantId),
    ]);

    const missing = evaluateCompleteness({
      restaurantName: brand?.name,
      logoUrl: brand?.logoUrl,
      about: brand?.about ?? {},
      photoCount: brand?.photoCount ?? 0,
      branchAddress: state.address,
      openHoursCount: state.openHoursCount,
    });

    return {
      branchId: state.branchId,
      restaurantId: state.restaurantId,
      publicPhone: state.publicPhone,
      address: state.address,
      city: state.city,
      menuPublic: state.menuPublic,
      reservationsPublic: state.reservationsPublic,
      listedInConsumerApp: state.listedInConsumerApp,
      consumerListingSuppressed: state.consumerListingSuppressed,
      effectiveListed: state.listedInConsumerApp && !state.consumerListingSuppressed,
      weeklyHours,
      completeness: { isComplete: missing.length === 0, missing },
    };
  }
}
