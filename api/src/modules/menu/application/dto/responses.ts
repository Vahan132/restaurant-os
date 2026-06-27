import { ApiProperty } from '@nestjs/swagger';
import { MenuCategory } from '../../domain/entities/menu-category';
import { MenuItem } from '../../domain/entities/menu-item';
import { ModifierGroup } from '../../domain/entities/modifier-group';
import { ModifierOption } from '../../domain/entities/modifier-option';
import { MenuItemWithModifiers } from '../queries/get-menu-item.usecase';

export class CategoryResponse {
  @ApiProperty() id!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty() displayOrder!: number;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] }) status!: string;

  static from(c: MenuCategory): CategoryResponse {
    return {
      id: c.id,
      restaurantId: c.restaurantId,
      branchId: c.branchId,
      code: c.code,
      name: c.name,
      description: c.description,
      displayOrder: c.displayOrder,
      status: c.status,
    };
  }
}

export class MenuItemResponse {
  @ApiProperty() id!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty() code!: string;
  @ApiProperty() categoryId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty() priceAmount!: number;
  @ApiProperty({ nullable: true, type: String }) imageUrl!: string | null;
  @ApiProperty({ enum: ['KITCHEN', 'BAR', 'DESSERT', 'OTHER'] }) preparationStation!: string;
  @ApiProperty({ nullable: true, type: Number }) prepTimeMinutes!: number | null;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] }) status!: string;
  @ApiProperty({ enum: ['AVAILABLE', 'UNAVAILABLE'] }) availability!: string;

  static from(i: MenuItem): MenuItemResponse {
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
      preparationStation: i.preparationStation,
      prepTimeMinutes: i.prepTimeMinutes,
      status: i.status,
      availability: i.availability,
    };
  }
}

export class ModifierOptionResponse {
  @ApiProperty() id!: string;
  @ApiProperty() modifierGroupId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() priceDeltaAmount!: number;
  @ApiProperty() displayOrder!: number;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] }) status!: string;

  static from(o: ModifierOption): ModifierOptionResponse {
    return {
      id: o.id,
      modifierGroupId: o.modifierGroupId,
      name: o.name,
      priceDeltaAmount: o.priceDeltaAmount,
      displayOrder: o.displayOrder,
      status: o.status,
    };
  }
}

export class ModifierGroupResponse {
  @ApiProperty() id!: string;
  @ApiProperty() menuItemId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['SINGLE', 'MULTIPLE'] }) selectionType!: string;
  @ApiProperty() required!: boolean;
  @ApiProperty({ nullable: true, type: Number }) minSelect!: number | null;
  @ApiProperty({ nullable: true, type: Number }) maxSelect!: number | null;
  @ApiProperty() displayOrder!: number;

  static from(g: ModifierGroup): ModifierGroupResponse {
    return {
      id: g.id,
      menuItemId: g.menuItemId,
      name: g.name,
      selectionType: g.selectionType,
      required: g.required,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      displayOrder: g.displayOrder,
    };
  }
}

export class ModifierGroupWithOptionsResponse extends ModifierGroupResponse {
  @ApiProperty({ type: [ModifierOptionResponse] }) options!: ModifierOptionResponse[];
}

export class MenuItemDetailResponse extends MenuItemResponse {
  @ApiProperty({ type: [ModifierGroupWithOptionsResponse] })
  modifierGroups!: ModifierGroupWithOptionsResponse[];

  static fromDetail(detail: MenuItemWithModifiers): MenuItemDetailResponse {
    const base = MenuItemResponse.from(detail.item);
    return {
      ...base,
      modifierGroups: detail.groups.map((g) => ({
        ...ModifierGroupResponse.from(g.group),
        options: g.options.map(ModifierOptionResponse.from),
      })),
    };
  }
}
