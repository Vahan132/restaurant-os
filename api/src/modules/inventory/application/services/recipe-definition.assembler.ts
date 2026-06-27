import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { ModifierConsumption, RecipeLine } from '../../domain/entities/recipe';
import {
  INVENTORY_ITEM_REPOSITORY,
  InventoryItemRepository,
} from '../../domain/repositories/inventory-item.repository';
import { MENU_ITEM_LOOKUP, MenuItemLookup } from '../ports/menu-item.lookup';
import {
  CrossBranchReference,
  InventoryItemNotFound,
  MenuItemNotFoundForRecipe,
  ModifierOptionNotFound,
} from '../application.errors';

export interface RawRecipeLine {
  itemId: string;
  baseQty: number;
}
export interface RawModifierConsumption {
  modifierOptionId: string;
  itemId: string;
  baseQty: number;
}

/**
 * Validates that the menu item, inventory items, and modifier options referenced
 * by a recipe are tenant-owned, and builds the domain value objects with ids.
 */
@Injectable()
export class RecipeDefinitionAssembler {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly items: InventoryItemRepository,
    @Inject(MENU_ITEM_LOOKUP) private readonly menu: MenuItemLookup,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /** The recipe's menu item must exist and live in the same active branch (§5). */
  async validateMenuItem(
    restaurantId: string,
    branchId: string,
    menuItemId: string,
  ): Promise<void> {
    const menuItemBranchId = await this.menu.menuItemBranchId(restaurantId, menuItemId);
    if (menuItemBranchId === null) {
      throw MenuItemNotFoundForRecipe();
    }
    if (menuItemBranchId !== branchId) {
      throw CrossBranchReference('Recipe references a menu item in a different branch.');
    }
  }

  async build(
    restaurantId: string,
    branchId: string,
    lines: RawRecipeLine[],
    modifierConsumptions: RawModifierConsumption[],
  ): Promise<{ lines: RecipeLine[]; modifierConsumptions: ModifierConsumption[] }> {
    // Every referenced inventory item must live in the same active branch (§5):
    // load branch-agnostically so we can detect a cross-branch reference.
    const itemIds = [...new Set([...lines, ...modifierConsumptions].map((x) => x.itemId))];
    for (const id of itemIds) {
      const item = await this.items.findInRestaurant(restaurantId, id);
      if (!item) {
        throw InventoryItemNotFound();
      }
      if (item.branchId !== branchId) {
        throw CrossBranchReference('Recipe references an inventory item in a different branch.');
      }
    }

    const optionIds = [...new Set(modifierConsumptions.map((m) => m.modifierOptionId))];
    if (optionIds.length > 0) {
      // Branch-scoped: a cross-branch option is simply absent from the set.
      const existingOptions = await this.menu.existingModifierOptionIdsInBranch(
        restaurantId,
        branchId,
        optionIds,
      );
      for (const id of optionIds) {
        if (!existingOptions.has(id)) {
          throw ModifierOptionNotFound();
        }
      }
    }

    return {
      lines: lines.map(
        (l) =>
          new RecipeLine({
            id: this.ids.generate(),
            branchId,
            itemId: l.itemId,
            baseQty: l.baseQty,
          }),
      ),
      modifierConsumptions: modifierConsumptions.map(
        (m) =>
          new ModifierConsumption({
            id: this.ids.generate(),
            restaurantId,
            branchId,
            modifierOptionId: m.modifierOptionId,
            itemId: m.itemId,
            baseQty: m.baseQty,
          }),
      ),
    };
  }
}
