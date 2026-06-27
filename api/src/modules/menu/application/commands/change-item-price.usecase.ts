import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { MenuItem } from '../../domain/entities/menu-item';
import {
  MENU_ITEM_REPOSITORY,
  MenuItemRepository,
} from '../../domain/repositories/menu-item.repository';
import { MenuItemNotFound, NoRestaurantInScope } from '../application.errors';

export interface ChangeItemPriceInput {
  restaurantId: string | null;
  branchId: string;
  itemId: string;
  priceAmount: number;
  actorUserId?: string | null;
}

/** Change an item's price (emits MenuItemPriceChanged). Rejects negatives. */
@Injectable()
export class ChangeItemPriceUseCase implements UseCase<ChangeItemPriceInput, MenuItem> {
  constructor(
    @Inject(MENU_ITEM_REPOSITORY) private readonly items: MenuItemRepository,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: ChangeItemPriceInput): Promise<MenuItem> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const item = await this.items.findById(input.restaurantId, input.branchId, input.itemId);
    if (!item) {
      throw MenuItemNotFound();
    }
    item.changePrice(input.priceAmount, input.actorUserId ?? null); // rejects negatives, emits event
    await this.items.update(item);
    await this.events.publishFromAggregate(item);
    return item;
  }
}
