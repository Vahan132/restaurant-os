import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DishModifierGroup } from '../../domain/entities/dish-modifier-group';
import { MenuItem } from '../../domain/entities/menu-item';
import { ModifierGroup } from '../../domain/entities/modifier-group';
import { ModifierOption } from '../../domain/entities/modifier-option';
import { EffectiveModifierRules, resolveEffectiveModifierRules } from '../../domain/modifier-rules';
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
  MODIFIER_OPTION_REPOSITORY,
  ModifierOptionRepository,
} from '../../domain/repositories/modifier-option.repository';
import { MenuItemNotFound, NoRestaurantInScope } from '../application.errors';

export interface GetMenuItemInput {
  restaurantId: string | null;
  branchId: string;
  itemId: string;
}

export interface MenuItemAttachedGroup {
  attachment: DishModifierGroup;
  group: ModifierGroup;
  options: ModifierOption[];
  /** Group rules with the attachment's overrides applied (server-resolved). */
  effective: EffectiveModifierRules;
}

export interface MenuItemWithModifiers {
  item: MenuItem;
  groups: MenuItemAttachedGroup[];
}

/**
 * Fetch a single dish including its ATTACHED modifier groups + options, with the
 * effective (override-resolved) rules computed server-side so the frontend never
 * recomputes them. Tenant-scoped by (restaurantId, branchId).
 */
@Injectable()
export class GetMenuItemUseCase implements UseCase<GetMenuItemInput, MenuItemWithModifiers> {
  constructor(
    @Inject(MENU_ITEM_REPOSITORY) private readonly items: MenuItemRepository,
    @Inject(MODIFIER_GROUP_REPOSITORY) private readonly groups: ModifierGroupRepository,
    @Inject(MODIFIER_OPTION_REPOSITORY) private readonly options: ModifierOptionRepository,
    @Inject(DISH_MODIFIER_GROUP_REPOSITORY)
    private readonly attachments: DishModifierGroupRepository,
  ) {}

  async execute(input: GetMenuItemInput): Promise<MenuItemWithModifiers> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const item = await this.items.findById(input.restaurantId, input.branchId, input.itemId);
    if (!item) {
      throw MenuItemNotFound();
    }
    const links = await this.attachments.listByItem(input.restaurantId, input.branchId, item.id);
    const groupIds = links.map((l) => l.modifierGroupId);
    const groups = await this.groups.findManyByIds(input.restaurantId, input.branchId, groupIds);
    const groupById = new Map(groups.map((g) => [g.id, g]));
    const allOptions = await this.options.listByGroupIds(
      input.restaurantId,
      input.branchId,
      groupIds,
    );
    const optionsByGroup = new Map<string, ModifierOption[]>();
    for (const opt of allOptions) {
      const arr = optionsByGroup.get(opt.modifierGroupId) ?? [];
      arr.push(opt);
      optionsByGroup.set(opt.modifierGroupId, arr);
    }

    const attachedGroups: MenuItemAttachedGroup[] = [];
    // `links` is already ordered by sortOrder. Skip a link whose group was
    // soft-deleted (findManyByIds excludes deleted rows) to stay consistent.
    for (const link of links) {
      const group = groupById.get(link.modifierGroupId);
      if (!group) {
        continue;
      }
      const effective = resolveEffectiveModifierRules(
        {
          selectionType: group.selectionType,
          required: group.required,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
        },
        {
          requiredOverride: link.requiredOverride,
          minOverride: link.minOverride,
          maxOverride: link.maxOverride,
        },
      );
      attachedGroups.push({
        attachment: link,
        group,
        options: optionsByGroup.get(group.id) ?? [],
        effective,
      });
    }
    return { item, groups: attachedGroups };
  }
}
