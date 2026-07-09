import {
  DishModifierGroup as PrismaDishGroup,
  MenuCategory as PrismaCategory,
  MenuItem as PrismaItem,
  ModifierGroup as PrismaGroup,
  ModifierOption as PrismaOption,
} from '@prisma/client';
import { DishModifierGroup } from '../../domain/entities/dish-modifier-group';
import { MenuCategory } from '../../domain/entities/menu-category';
import { MenuItem } from '../../domain/entities/menu-item';
import { ModifierGroup } from '../../domain/entities/modifier-group';
import { ModifierOption } from '../../domain/entities/modifier-option';
import {
  ItemAvailability,
  MenuStatus,
  ModifierSelectionType,
  PreparationStation,
} from '../../domain/enums';

export class CategoryMapper {
  static toDomain(r: PrismaCategory): MenuCategory {
    return MenuCategory.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      code: r.code,
      name: r.name,
      description: r.description,
      displayOrder: r.displayOrder,
      status: r.status as MenuStatus,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
    });
  }

  static toCreate(c: MenuCategory) {
    return {
      id: c.id,
      restaurantId: c.restaurantId,
      branchId: c.branchId,
      code: c.code,
      name: c.name,
      description: c.description,
      displayOrder: c.displayOrder,
      status: c.status as MenuStatus,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      deletedAt: c.deletedAt,
    };
  }

  static toUpdate(c: MenuCategory) {
    return {
      name: c.name,
      description: c.description,
      displayOrder: c.displayOrder,
      status: c.status as MenuStatus,
      updatedAt: c.updatedAt,
      deletedAt: c.deletedAt,
    };
  }
}

export class ItemMapper {
  static toDomain(r: PrismaItem): MenuItem {
    return MenuItem.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      code: r.code,
      categoryId: r.categoryId,
      name: r.name,
      description: r.description,
      priceAmount: r.priceAmount,
      imageUrl: r.imageUrl,
      preparationStation: r.preparationStation as PreparationStation,
      prepTimeMinutes: r.prepTimeMinutes,
      status: r.status as MenuStatus,
      availability: r.availability as ItemAvailability,
      hideRecipe: r.hideRecipe,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
    });
  }

  static toCreate(i: MenuItem) {
    return {
      id: i.id,
      restaurantId: i.restaurantId,
      branchId: i.branchId,
      code: i.code,
      categoryId: i.categoryId,
      name: i.name,
      description: i.description,
      priceAmount: i.priceAmount,
      imageUrl: i.imageUrl,
      preparationStation: i.preparationStation as PreparationStation,
      prepTimeMinutes: i.prepTimeMinutes,
      status: i.status as MenuStatus,
      availability: i.availability as ItemAvailability,
      hideRecipe: i.hideRecipe,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
      deletedAt: i.deletedAt,
    };
  }

  static toUpdate(i: MenuItem) {
    return {
      categoryId: i.categoryId,
      name: i.name,
      description: i.description,
      priceAmount: i.priceAmount,
      imageUrl: i.imageUrl,
      preparationStation: i.preparationStation as PreparationStation,
      prepTimeMinutes: i.prepTimeMinutes,
      status: i.status as MenuStatus,
      availability: i.availability as ItemAvailability,
      hideRecipe: i.hideRecipe,
      updatedAt: i.updatedAt,
      deletedAt: i.deletedAt,
    };
  }
}

export class GroupMapper {
  static toDomain(r: PrismaGroup): ModifierGroup {
    return ModifierGroup.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      name: r.name,
      selectionType: r.selectionType as ModifierSelectionType,
      required: r.required,
      minSelect: r.minSelect,
      maxSelect: r.maxSelect,
      status: r.status as MenuStatus,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
    });
  }

  static toCreate(g: ModifierGroup) {
    return {
      id: g.id,
      restaurantId: g.restaurantId,
      branchId: g.branchId,
      name: g.name,
      selectionType: g.selectionType as ModifierSelectionType,
      required: g.required,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      status: g.status as MenuStatus,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
      deletedAt: g.deletedAt,
    };
  }

  static toUpdate(g: ModifierGroup) {
    return {
      name: g.name,
      selectionType: g.selectionType as ModifierSelectionType,
      required: g.required,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      status: g.status as MenuStatus,
      updatedAt: g.updatedAt,
      deletedAt: g.deletedAt,
    };
  }
}

export class OptionMapper {
  static toDomain(r: PrismaOption): ModifierOption {
    return ModifierOption.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      modifierGroupId: r.modifierGroupId,
      name: r.name,
      priceDeltaAmount: r.priceDeltaAmount,
      sortOrder: r.sortOrder,
      isDefault: r.isDefault,
      status: r.status as MenuStatus,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
    });
  }

  static toCreate(o: ModifierOption) {
    return {
      id: o.id,
      restaurantId: o.restaurantId,
      branchId: o.branchId,
      modifierGroupId: o.modifierGroupId,
      name: o.name,
      priceDeltaAmount: o.priceDeltaAmount,
      sortOrder: o.sortOrder,
      isDefault: o.isDefault,
      status: o.status as MenuStatus,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      deletedAt: o.deletedAt,
    };
  }

  static toUpdate(o: ModifierOption) {
    return {
      name: o.name,
      priceDeltaAmount: o.priceDeltaAmount,
      sortOrder: o.sortOrder,
      isDefault: o.isDefault,
      status: o.status as MenuStatus,
      updatedAt: o.updatedAt,
      deletedAt: o.deletedAt,
    };
  }
}

export class DishModifierGroupMapper {
  static toDomain(r: PrismaDishGroup): DishModifierGroup {
    return DishModifierGroup.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      menuItemId: r.menuItemId,
      modifierGroupId: r.modifierGroupId,
      requiredOverride: r.requiredOverride,
      minOverride: r.minOverride,
      maxOverride: r.maxOverride,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }

  static toCreate(a: DishModifierGroup) {
    return {
      id: a.id,
      restaurantId: a.restaurantId,
      branchId: a.branchId,
      menuItemId: a.menuItemId,
      modifierGroupId: a.modifierGroupId,
      requiredOverride: a.requiredOverride,
      minOverride: a.minOverride,
      maxOverride: a.maxOverride,
      sortOrder: a.sortOrder,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }

  static toUpdate(a: DishModifierGroup) {
    return {
      requiredOverride: a.requiredOverride,
      minOverride: a.minOverride,
      maxOverride: a.maxOverride,
      sortOrder: a.sortOrder,
      updatedAt: a.updatedAt,
    };
  }
}
