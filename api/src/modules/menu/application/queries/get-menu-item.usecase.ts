import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { MenuItem } from '../../domain/entities/menu-item';
import { ModifierGroup } from '../../domain/entities/modifier-group';
import { ModifierOption } from '../../domain/entities/modifier-option';
import {
  MENU_ITEM_REPOSITORY,
  MenuItemRepository,
} from '../../domain/repositories/menu-item.repository';
import {
  MODIFIER_GROUP_REPOSITORY,
  ModifierGroupRepository,
} from '../../domain/repositories/modifier-group.repository';
import {
  MODIFIER_OPTION_REPOSITORY,
  ModifierOptionRepository,
} from '../../domain/repositories/modifier-option.repository';
import { MenuItemNotFound, NoRestaurantInScope } from '../application.errors';

export interface GetMenuItemInput {
  restaurantId: string | null;
  itemId: string;
}

export interface MenuItemWithModifiers {
  item: MenuItem;
  groups: { group: ModifierGroup; options: ModifierOption[] }[];
}

/** Fetch a single item including its modifier groups + options (tenant-scoped). */
@Injectable()
export class GetMenuItemUseCase implements UseCase<GetMenuItemInput, MenuItemWithModifiers> {
  constructor(
    @Inject(MENU_ITEM_REPOSITORY) private readonly items: MenuItemRepository,
    @Inject(MODIFIER_GROUP_REPOSITORY) private readonly groups: ModifierGroupRepository,
    @Inject(MODIFIER_OPTION_REPOSITORY) private readonly options: ModifierOptionRepository,
  ) {}

  async execute(input: GetMenuItemInput): Promise<MenuItemWithModifiers> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const item = await this.items.findById(input.restaurantId, input.itemId);
    if (!item) {
      throw MenuItemNotFound();
    }
    const groups = await this.groups.listByItem(input.restaurantId, item.id);
    const withOptions = await Promise.all(
      groups.map(async (group) => ({
        group,
        options: await this.options.listByGroup(input.restaurantId as string, group.id),
      })),
    );
    return { item, groups: withOptions };
  }
}
