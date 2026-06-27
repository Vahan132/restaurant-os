import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { OrderItem } from '../../domain/entities/order-item';
import { OrderItemModifier } from '../../domain/entities/order-item-modifier';
import {
  CrossBranchReference,
  InvalidModifierSelection,
  MenuItemNotFound,
  MenuItemNotOrderable,
} from '../application.errors';
import { MENU_READER, MenuReader, ModifierGroupForOrder } from '../ports/menu-reader.port';

export interface BuildOrderItemInput {
  restaurantId: string;
  /** The owning order's branch; the menu item must belong to it. */
  branchId: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  selectedOptionIds: string[];
  note?: string | null;
}

/**
 * Loads the menu item + its modifier groups, validates the selection against
 * the menu's rules, snapshots name/price/station/modifier deltas, and produces
 * a domain OrderItem. Reused by Add and Edit. Tenant-scoped by restaurantId.
 */
@Injectable()
export class OrderItemBuilder {
  constructor(
    @Inject(MENU_READER) private readonly menu: MenuReader,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /** Validate selection + snapshot modifiers for an already-loaded menu item. */
  buildModifiersFor(
    data: { item: { name: string }; groups: ModifierGroupForOrder[] },
    selectedOptionIds: string[],
  ): OrderItemModifier[] {
    const selected = [...new Set(selectedOptionIds)];
    const optionToGroup = new Map<
      string,
      { group: ModifierGroupForOrder; name: string; delta: number }
    >();
    for (const group of data.groups) {
      for (const opt of group.options) {
        optionToGroup.set(opt.id, { group, name: opt.name, delta: opt.priceDeltaAmount });
      }
    }
    for (const optId of selected) {
      const found = optionToGroup.get(optId);
      if (!found) {
        throw InvalidModifierSelection(`Option ${optId} does not belong to this item.`);
      }
      if (found.delta < 0) {
        throw InvalidModifierSelection('Modifier option has an invalid price.');
      }
    }
    const countByGroup = new Map<string, number>();
    for (const optId of selected) {
      const g = optionToGroup.get(optId)!.group;
      countByGroup.set(g.id, (countByGroup.get(g.id) ?? 0) + 1);
    }
    for (const group of data.groups) {
      const count = countByGroup.get(group.id) ?? 0;
      const min = group.minSelect ?? (group.required ? 1 : 0);
      const max = group.maxSelect;
      if (count < min) {
        throw InvalidModifierSelection(
          `Group "${group.name}" requires at least ${min} selection(s).`,
        );
      }
      if (max !== null && count > max) {
        throw InvalidModifierSelection(`Group "${group.name}" allows at most ${max} selection(s).`);
      }
      if (group.selectionType === 'SINGLE' && count > 1) {
        throw InvalidModifierSelection(`Group "${group.name}" allows only one selection.`);
      }
    }
    return selected.map((optId) => {
      const found = optionToGroup.get(optId)!;
      return OrderItemModifier.create(this.ids.generate(), {
        modifierGroupId: found.group.id,
        modifierOptionId: optId,
        nameSnapshot: `${found.group.name}: ${found.name}`,
        priceDeltaAmount: found.delta,
      });
    });
  }

  async loadOrderable(restaurantId: string, menuItemId: string) {
    const data = await this.menu.getItemWithModifiers(restaurantId, menuItemId);
    if (!data) {
      throw MenuItemNotFound();
    }
    if (data.item.status !== 'ACTIVE' || data.item.availability !== 'AVAILABLE') {
      throw MenuItemNotOrderable();
    }
    return data;
  }

  async build(input: BuildOrderItemInput): Promise<OrderItem> {
    const data = await this.loadOrderable(input.restaurantId, input.menuItemId);
    // Intra-branch integrity: the menu item must live in the order's branch.
    if (data.item.branchId !== input.branchId) {
      throw CrossBranchReference('Menu item belongs to a different branch.');
    }
    const modifiers = this.buildModifiersFor(data, input.selectedOptionIds);
    return OrderItem.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      orderId: input.orderId,
      menuItemId: data.item.id,
      nameSnapshot: data.item.name,
      unitPriceAmount: data.item.priceAmount,
      preparationStation: data.item.preparationStation,
      quantity: input.quantity,
      note: input.note ?? null,
      modifiers,
    });
  }
}
