import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  PLATFORM_ADMIN_QUERY,
  PlatformAdminQuery,
  RestaurantWithHallsView,
} from '../ports/platform-admin-query.port';

@Injectable()
export class GetOrgRestaurantsUseCase implements UseCase<
  { organizationId: string },
  RestaurantWithHallsView[]
> {
  constructor(@Inject(PLATFORM_ADMIN_QUERY) private readonly query: PlatformAdminQuery) {}
  execute(input: { organizationId: string }): Promise<RestaurantWithHallsView[]> {
    return this.query.orgRestaurants(input.organizationId);
  }
}
