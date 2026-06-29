import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import {
  RestaurantSettings,
  UpdateRestaurantSettingsInput as SettingsPatch,
} from '../../domain/entities/restaurant-settings';
import { AdminLoginPolicyChangedEvent } from '../../domain/events/policy-events';
import {
  RESTAURANT_REPOSITORY,
  RestaurantRepository,
} from '../../domain/repositories/restaurant.repository';
import {
  RESTAURANT_SETTINGS_REPOSITORY,
  RestaurantSettingsRepository,
} from '../../domain/repositories/restaurant-settings.repository';
import {
  NoRestaurantInScope,
  RestaurantNotFound,
  RestaurantSettingsNotFound,
} from '../application.errors';

export interface UpdateRestaurantSettingsInput {
  organizationId: string;
  restaurantId: string | null;
  patch: SettingsPatch;
  actorUserId?: string | null;
  ip?: string | null;
}

/** Update the tenant's restaurant settings (bps validated in the aggregate). */
@Injectable()
export class UpdateRestaurantSettingsUseCase implements UseCase<
  UpdateRestaurantSettingsInput,
  RestaurantSettings
> {
  constructor(
    @Inject(RESTAURANT_REPOSITORY) private readonly restaurants: RestaurantRepository,
    @Inject(RESTAURANT_SETTINGS_REPOSITORY)
    private readonly settings: RestaurantSettingsRepository,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: UpdateRestaurantSettingsInput): Promise<RestaurantSettings> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const restaurant = await this.restaurants.findByIdInOrg(
      input.organizationId,
      input.restaurantId,
    );
    if (!restaurant) {
      throw RestaurantNotFound();
    }
    const settings = await this.settings.findByRestaurantId(input.restaurantId);
    if (!settings) {
      throw RestaurantSettingsNotFound();
    }
    // Capture the pre-change value so the 3A admin-anchoring toggle is audited
    // only when it actually flips.
    const before = settings.snapshot.allowUnanchoredAdminLogin;
    settings.updateSettings(input.patch);
    const after = settings.snapshot.allowUnanchoredAdminLogin;
    await this.settings.update(settings);

    if (before !== after) {
      await this.events.publish(
        new AdminLoginPolicyChangedEvent(
          input.restaurantId,
          input.actorUserId ?? null,
          after,
          input.ip ?? null,
        ),
      );
    }
    return settings;
  }
}
