import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import {
  MENU_ITEM_REPOSITORY,
  MenuItemRepository,
} from '../../domain/repositories/menu-item.repository';
import { MenuItemNotFound, NoRestaurantInScope } from '../application.errors';

export interface DeleteMenuItemInput {
  restaurantId: string | null;
  itemId: string;
  actorUserId?: string | null;
}

/** Soft-delete a menu item (emits MenuItemDeleted). */
@Injectable()
export class DeleteMenuItemUseCase implements UseCase<DeleteMenuItemInput, void> {
  constructor(
    @Inject(MENU_ITEM_REPOSITORY) private readonly items: MenuItemRepository,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: DeleteMenuItemInput): Promise<void> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const item = await this.items.findById(input.restaurantId, input.itemId);
    if (!item) {
      throw MenuItemNotFound();
    }
    item.softDelete(input.actorUserId ?? null);
    await this.items.update(item);
    await this.events.publishFromAggregate(item);
  }
}
