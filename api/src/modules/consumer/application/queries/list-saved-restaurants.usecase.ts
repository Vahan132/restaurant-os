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
import { SavedRestaurantCardResponse } from '../dto/booking-saved.dto';

/**
 * "Saved restaurants" (AUTH). Returns saved branches as discovery-style cards
 * (reusing the CX-1 card shape), newest-saved first. A branch that is no longer
 * effectively listed is still returned but flagged `listed: false` with only its
 * id + savedAt, so the app can show a tombstone / offer to unsave.
 */
@Injectable()
export class ListSavedRestaurantsUseCase
  implements UseCase<string, SavedRestaurantCardResponse[]>
{
  constructor(
    @Inject(SAVED_RESTAURANT_REPOSITORY) private readonly saved: SavedRestaurantRepository,
    @Inject(BRANCH_PUBLIC_REPOSITORY) private readonly branches: BranchPublicRepository,
  ) {}

  async execute(customerAccountId: string): Promise<SavedRestaurantCardResponse[]> {
    const records = await this.saved.listByConsumer(customerAccountId);
    if (records.length === 0) {
      return [];
    }

    const cards = await this.branches.getCardsByBranchIds(records.map((r) => r.branchId));
    const byBranch = new Map(cards.map((c) => [c.branchId, c]));

    // Preserve saved order (newest first); fill in listed/unlisted state per branch.
    return records.map((rec) => {
      const card = byBranch.get(rec.branchId);
      if (!card) {
        return {
          branchId: rec.branchId,
          savedAt: rec.createdAt.toISOString(),
          listed: false,
          restaurantId: null,
          name: null,
          logoUrl: null,
          heroPhotoUrl: null,
          address: null,
          city: null,
          menuPublic: null,
          reservationsPublic: null,
          attributes: [],
        };
      }
      return {
        branchId: card.branchId,
        savedAt: rec.createdAt.toISOString(),
        listed: true,
        restaurantId: card.restaurantId,
        name: card.name,
        logoUrl: card.logoUrl,
        heroPhotoUrl: card.heroPhotoUrl,
        address: card.address,
        city: card.city,
        menuPublic: card.menuPublic,
        reservationsPublic: card.reservationsPublic,
        attributes: card.attributes,
      };
    });
  }
}
