import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { MenuItem } from '../../domain/entities/menu-item';
import { ItemAvailability } from '../../domain/enums';
import {
  MENU_ITEM_REPOSITORY,
  MenuItemRepository,
} from '../../domain/repositories/menu-item.repository';
import { MenuItemNotFound, NoRestaurantInScope } from '../application.errors';

export interface SetItemAvailabilityInput {
  restaurantId: string | null;
  itemId: string;
  availability: ItemAvailability;
}

/** Toggle item availability (emits MenuItemAvailabilityChanged). MENU_MANAGE gated. */
@Injectable()
export class SetItemAvailabilityUseCase implements UseCase<SetItemAvailabilityInput, MenuItem> {
  constructor(
    @Inject(MENU_ITEM_REPOSITORY) private readonly items: MenuItemRepository,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: SetItemAvailabilityInput): Promise<MenuItem> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const item = await this.items.findById(input.restaurantId, input.itemId);
    if (!item) {
      throw MenuItemNotFound();
    }
    item.setAvailability(input.availability);
    await this.items.update(item);
    await this.events.publishFromAggregate(item);
    return item;
  }
}
