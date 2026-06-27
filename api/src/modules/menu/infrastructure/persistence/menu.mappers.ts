import {
  MenuCategory as PrismaCategory,
  MenuItem as PrismaItem,
  ModifierGroup as PrismaGroup,
  ModifierOption as PrismaOption,
} from '@prisma/client';
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
      menuItemId: r.menuItemId,
      name: r.name,
      selectionType: r.selectionType as ModifierSelectionType,
      required: r.required,
      minSelect: r.minSelect,
      maxSelect: r.maxSelect,
      displayOrder: r.displayOrder,
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
      menuItemId: g.menuItemId,
      name: g.name,
      selectionType: g.selectionType as ModifierSelectionType,
      required: g.required,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      displayOrder: g.displayOrder,
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
      displayOrder: g.displayOrder,
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
      displayOrder: r.displayOrder,
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
      displayOrder: o.displayOrder,
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
      displayOrder: o.displayOrder,
      status: o.status as MenuStatus,
      updatedAt: o.updatedAt,
      deletedAt: o.deletedAt,
    };
  }
}
