import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { ModifierGroup } from '../../domain/entities/modifier-group';
import { ModifierSelectionType } from '../../domain/enums';
import {
  MENU_ITEM_REPOSITORY,
  MenuItemRepository,
} from '../../domain/repositories/menu-item.repository';
import {
  MODIFIER_GROUP_REPOSITORY,
  ModifierGroupRepository,
} from '../../domain/repositories/modifier-group.repository';
import { CrossBranchReference, MenuItemNotFound, NoRestaurantInScope } from '../application.errors';

export interface AddModifierGroupInput {
  restaurantId: string | null;
  branchId: string;
  itemId: string;
  name: string;
  selectionType: ModifierSelectionType;
  required?: boolean;
  minSelect?: number | null;
  maxSelect?: number | null;
  displayOrder?: number;
}

/** Add a per-item modifier group (verifies the item belongs to the restaurant). */
@Injectable()
export class AddModifierGroupUseCase implements UseCase<AddModifierGroupInput, ModifierGroup> {
  constructor(
    @Inject(MODIFIER_GROUP_REPOSITORY) private readonly groups: ModifierGroupRepository,
    @Inject(MENU_ITEM_REPOSITORY) private readonly items: MenuItemRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: AddModifierGroupInput): Promise<ModifierGroup> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const item = await this.items.findInRestaurant(input.restaurantId, input.itemId);
    if (!item) {
      throw MenuItemNotFound();
    }
    if (item.branchId !== input.branchId) {
      throw CrossBranchReference();
    }
    const group = ModifierGroup.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      menuItemId: input.itemId,
      name: input.name,
      selectionType: input.selectionType,
      required: input.required,
      minSelect: input.minSelect ?? null,
      maxSelect: input.maxSelect ?? null,
      displayOrder: input.displayOrder,
    });
    await this.groups.create(group);
    return group;
  }
}
