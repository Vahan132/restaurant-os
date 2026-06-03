import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { MenuItem } from '../../domain/entities/menu-item';
import { MenuStatus } from '../../domain/enums';
import {
  MENU_ITEM_REPOSITORY,
  MenuItemRepository,
} from '../../domain/repositories/menu-item.repository';
import { MenuItemNotFound, NoRestaurantInScope } from '../application.errors';

export interface SetItemStatusInput {
  restaurantId: string | null;
  itemId: string;
  status: MenuStatus;
}

/** Set item status (INACTIVE hides it from POS entirely). */
@Injectable()
export class SetItemStatusUseCase implements UseCase<SetItemStatusInput, MenuItem> {
  constructor(@Inject(MENU_ITEM_REPOSITORY) private readonly items: MenuItemRepository) {}

  async execute(input: SetItemStatusInput): Promise<MenuItem> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const item = await this.items.findById(input.restaurantId, input.itemId);
    if (!item) {
      throw MenuItemNotFound();
    }
    item.setStatus(input.status);
    await this.items.update(item);
    return item;
  }
}
