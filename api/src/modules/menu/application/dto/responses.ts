import { ApiProperty } from '@nestjs/swagger';
import { I18nTextResponse } from '../../../consumer/application/dto/responses';
import { DishModifierGroup } from '../../domain/entities/dish-modifier-group';
import { MenuCategory } from '../../domain/entities/menu-category';
import { MenuItem } from '../../domain/entities/menu-item';
import { ModifierGroup } from '../../domain/entities/modifier-group';
import { ModifierOption } from '../../domain/entities/modifier-option';
import { EffectiveModifierRules } from '../../domain/modifier-rules';
import { MenuItemAttachedGroup, MenuItemWithModifiers } from '../queries/get-menu-item.usecase';
import { ModifierGroupWithOptions } from '../queries/get-modifier-group.usecase';

export class CategoryResponse {
  @ApiProperty() id!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty({ type: I18nTextResponse, description: 'LOCALE-2A: hy/ru/en name translations (nulls where empty).' })
  nameI18n!: I18nTextResponse;
  @ApiProperty({ type: I18nTextResponse, description: 'LOCALE-2A: hy/ru/en description translations.' })
  descriptionI18n!: I18nTextResponse;
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
      nameI18n: c.nameI18n,
      descriptionI18n: c.descriptionI18n,
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
  @ApiProperty({ type: I18nTextResponse, description: 'LOCALE-2A: hy/ru/en name translations (nulls where empty).' })
  nameI18n!: I18nTextResponse;
  @ApiProperty({ type: I18nTextResponse, description: 'LOCALE-2A: hy/ru/en description translations.' })
  descriptionI18n!: I18nTextResponse;
  @ApiProperty() priceAmount!: number;
  @ApiProperty({ nullable: true, type: String }) imageUrl!: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'MEDIA-1: object-storage key when the image was uploaded (null for URL-paste).',
  })
  imageKey!: string | null;
  @ApiProperty({ enum: ['KITCHEN', 'BAR', 'DESSERT', 'OTHER'] }) preparationStation!: string;
  @ApiProperty({ nullable: true, type: Number }) prepTimeMinutes!: number | null;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] }) status!: string;
  @ApiProperty({ enum: ['AVAILABLE', 'UNAVAILABLE'] }) availability!: string;
  @ApiProperty({ description: 'Hides the customer ingredient list, not the allergen summary.' })
  hideRecipe!: boolean;
  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'ADGCODE-UI: SRC ATG classification code for fiscalization (null = not yet classified).',
  })
  adgCode!: string | null;

  static from(i: MenuItem): MenuItemResponse {
    return {
      id: i.id,
      restaurantId: i.restaurantId,
      branchId: i.branchId,
      code: i.code,
      categoryId: i.categoryId,
      name: i.name,
      description: i.description,
      nameI18n: i.nameI18n,
      descriptionI18n: i.descriptionI18n,
      priceAmount: i.priceAmount,
      imageUrl: i.imageUrl,
      imageKey: i.imageKey,
      preparationStation: i.preparationStation,
      prepTimeMinutes: i.prepTimeMinutes,
      status: i.status,
      availability: i.availability,
      hideRecipe: i.hideRecipe,
      adgCode: i.adgCode,
    };
  }
}

export class ModifierOptionResponse {
  @ApiProperty() id!: string;
  @ApiProperty() modifierGroupId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: I18nTextResponse, description: 'LOCALE-2A: hy/ru/en name translations.' })
  nameI18n!: I18nTextResponse;
  @ApiProperty({ description: 'May be 0 or negative (minor units).' }) priceDeltaAmount!: number;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isDefault!: boolean;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] }) status!: string;

  static from(o: ModifierOption): ModifierOptionResponse {
    return {
      id: o.id,
      modifierGroupId: o.modifierGroupId,
      name: o.name,
      nameI18n: o.nameI18n,
      priceDeltaAmount: o.priceDeltaAmount,
      sortOrder: o.sortOrder,
      isDefault: o.isDefault,
      status: o.status,
    };
  }
}

/** A reusable library modifier group (Prompt 1A — no longer dish-owned). */
export class ModifierGroupResponse {
  @ApiProperty() id!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: I18nTextResponse, description: 'LOCALE-2A: hy/ru/en name translations.' })
  nameI18n!: I18nTextResponse;
  @ApiProperty({ enum: ['SINGLE', 'MULTIPLE'] }) selectionType!: string;
  @ApiProperty() required!: boolean;
  @ApiProperty({ nullable: true, type: Number }) minSelect!: number | null;
  @ApiProperty({ nullable: true, type: Number }) maxSelect!: number | null;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] }) status!: string;

  static from(g: ModifierGroup): ModifierGroupResponse {
    return {
      id: g.id,
      restaurantId: g.restaurantId,
      branchId: g.branchId,
      name: g.name,
      nameI18n: g.nameI18n,
      selectionType: g.selectionType,
      required: g.required,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      status: g.status,
    };
  }
}

export class ModifierGroupWithOptionsResponse extends ModifierGroupResponse {
  @ApiProperty({ type: [ModifierOptionResponse] }) options!: ModifierOptionResponse[];

  static fromGroup(detail: ModifierGroupWithOptions): ModifierGroupWithOptionsResponse {
    return {
      ...ModifierGroupResponse.from(detail.group),
      options: detail.options.map(ModifierOptionResponse.from),
    };
  }
}

/** The dish↔group attachment, including its raw per-attachment overrides. */
export class DishModifierGroupResponse {
  @ApiProperty() menuItemId!: string;
  @ApiProperty() modifierGroupId!: string;
  @ApiProperty({ nullable: true, type: Boolean }) requiredOverride!: boolean | null;
  @ApiProperty({ nullable: true, type: Number }) minOverride!: number | null;
  @ApiProperty({ nullable: true, type: Number }) maxOverride!: number | null;
  @ApiProperty() sortOrder!: number;

  static from(a: DishModifierGroup): DishModifierGroupResponse {
    return {
      menuItemId: a.menuItemId,
      modifierGroupId: a.modifierGroupId,
      requiredOverride: a.requiredOverride,
      minOverride: a.minOverride,
      maxOverride: a.maxOverride,
      sortOrder: a.sortOrder,
    };
  }
}

/** Effective rules = group rules with attachment overrides applied (server-resolved). */
export class EffectiveModifierRulesResponse {
  @ApiProperty({ enum: ['SINGLE', 'MULTIPLE'] }) selectionType!: string;
  @ApiProperty() required!: boolean;
  @ApiProperty() minSelect!: number;
  @ApiProperty({ nullable: true, type: Number }) maxSelect!: number | null;

  static from(e: EffectiveModifierRules): EffectiveModifierRulesResponse {
    return {
      selectionType: e.selectionType,
      required: e.required,
      minSelect: e.minSelect,
      maxSelect: e.maxSelect,
    };
  }
}

/** A modifier group AS ATTACHED to a dish: base group + options + overrides + effective rules. */
export class AttachedModifierGroupResponse extends ModifierGroupResponse {
  @ApiProperty() sortOrder!: number;
  @ApiProperty({ type: DishModifierGroupResponse }) attachment!: DishModifierGroupResponse;
  @ApiProperty({ type: EffectiveModifierRulesResponse }) effective!: EffectiveModifierRulesResponse;
  @ApiProperty({ type: [ModifierOptionResponse] }) options!: ModifierOptionResponse[];

  static fromAttached(g: MenuItemAttachedGroup): AttachedModifierGroupResponse {
    return {
      ...ModifierGroupResponse.from(g.group),
      sortOrder: g.attachment.sortOrder,
      attachment: DishModifierGroupResponse.from(g.attachment),
      effective: EffectiveModifierRulesResponse.from(g.effective),
      options: g.options.map(ModifierOptionResponse.from),
    };
  }
}

export class MenuItemDetailResponse extends MenuItemResponse {
  @ApiProperty({ type: [AttachedModifierGroupResponse] })
  modifierGroups!: AttachedModifierGroupResponse[];

  static fromDetail(detail: MenuItemWithModifiers): MenuItemDetailResponse {
    const base = MenuItemResponse.from(detail.item);
    return {
      ...base,
      modifierGroups: detail.groups.map(AttachedModifierGroupResponse.fromAttached),
    };
  }
}
