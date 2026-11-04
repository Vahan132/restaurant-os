import { Inject, Injectable } from '@nestjs/common';
import {
  BranchView,
  PLATFORM_ADMIN_QUERY,
  PlatformAdminQuery,
} from '../ports/platform-admin-query.port';

/** Platform-admin: branches of a restaurant, for the FISCAL-4-FE tenant picker. */
@Injectable()
export class ListRestaurantBranchesUseCase {
  constructor(@Inject(PLATFORM_ADMIN_QUERY) private readonly query: PlatformAdminQuery) {}

  execute(restaurantId: string): Promise<BranchView[]> {
    return this.query.restaurantBranches(restaurantId);
  }
}
