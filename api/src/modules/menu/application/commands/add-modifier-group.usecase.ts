import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { DishModifierGroup } from '../../domain/entities/dish-modifier-group';
import {
  DISH_MODIFIER_GROUP_REPOSITORY,
  DishModifierGroupRepository,
} from '../../domain/repositories/dish-modifier-group.repository';
import {
  MENU_ITEM_REPOSITORY,
  MenuItemRepository,
} from '../../domain/repositories/menu-item.repository';
import {
  MODIFIER_GROUP_REPOSITORY,
  ModifierGroupRepository,
} from '../../domain/repositories/modifier-group.repository';
import {
  MenuItemNotFound,
  ModifierGroupAlreadyAttached,
  ModifierGroupNotFound,
  NoRestaurantInScope,
} from '../application.errors';

export interface AttachModifierGroupInput {
  restaurantId: string | null;
  branchId: string;
  itemId: string;
  groupId: string;
  requiredOverride?: boolean | null;
  minOverride?: number | null;
  maxOverride?: number | null;
  sortOrder?: number;
}

/**
 * Attach an existing library modifier group to a dish (Prompt 1A). Both the dish
 * and the group must live in the caller's restaurant + active branch. Idempotency
 * is enforced by the (dish, group) unique constraint + an explicit guard.
 */
@Injectable()
export class AttachModifierGroupToDishUseCase implements UseCase<
  AttachModifierGroupInput,
  DishModifierGroup
> {
  constructor(
    @Inject(DISH_MODIFIER_GROUP_REPOSITORY)
    private readonly attachments: DishModifierGroupRepository,
    @Inject(MENU_ITEM_REPOSITORY) private readonly items: MenuItemRepository,
    @Inject(MODIFIER_GROUP_REPOSITORY) private readonly groups: ModifierGroupRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: AttachModifierGroupInput): Promise<DishModifierGroup> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const item = await this.items.findById(input.restaurantId, input.branchId, input.itemId);
    if (!item) {
      throw MenuItemNotFound();
    }
    const group = await this.groups.findById(input.restaurantId, input.branchId, input.groupId);
    if (!group) {
      throw ModifierGroupNotFound();
    }
    const existing = await this.attachments.findByItemAndGroup(
      input.restaurantId,
      input.branchId,
      item.id,
      group.id,
    );
    if (existing) {
      throw ModifierGroupAlreadyAttached();
    }
    let sortOrder = input.sortOrder;
    if (sortOrder === undefined) {
      const max = await this.attachments.maxSortOrderForItem(
        input.restaurantId,
        input.branchId,
        item.id,
      );
      sortOrder = (max ?? -1) + 1;
    }
    const attachment = DishModifierGroup.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      menuItemId: item.id,
      modifierGroupId: group.id,
      requiredOverride: input.requiredOverride ?? null,
      minOverride: input.minOverride ?? null,
      maxOverride: input.maxOverride ?? null,
      sortOrder,
    });
    await this.attachments.create(attachment);
    return attachment;
  }
}
