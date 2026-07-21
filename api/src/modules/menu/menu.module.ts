import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { MediaModule } from '../media/media.module';

import { DISH_MODIFIER_GROUP_REPOSITORY } from './domain/repositories/dish-modifier-group.repository';
import { MENU_CATEGORY_REPOSITORY } from './domain/repositories/menu-category.repository';
import { MENU_ITEM_REPOSITORY } from './domain/repositories/menu-item.repository';
import { MODIFIER_GROUP_REPOSITORY } from './domain/repositories/modifier-group.repository';
import { MODIFIER_OPTION_REPOSITORY } from './domain/repositories/modifier-option.repository';
import { MENU_TREE_READER } from './application/ports/menu-tree.reader';
import { FISCAL_DEPARTMENT_READER } from './application/ports/fiscal-department.reader';

import { ListCategoriesUseCase } from './application/queries/list-categories.usecase';
import { CreateCategoryUseCase } from './application/commands/create-category.usecase';
import { UpdateCategoryUseCase } from './application/commands/update-category.usecase';
import { SetCategoryStatusUseCase } from './application/commands/set-category-status.usecase';
import { ReorderCategoriesUseCase } from './application/commands/reorder-categories.usecase';
import { DeleteCategoryUseCase } from './application/commands/delete-category.usecase';
import { ListMenuItemsUseCase } from './application/queries/list-menu-items.usecase';
import { GetMenuItemUseCase } from './application/queries/get-menu-item.usecase';
import { CreateMenuItemUseCase } from './application/commands/create-menu-item.usecase';
import { UpdateMenuItemUseCase } from './application/commands/update-menu-item.usecase';
import { ChangeItemPriceUseCase } from './application/commands/change-item-price.usecase';
import { SetItemStatusUseCase } from './application/commands/set-item-status.usecase';
import { SetItemAvailabilityUseCase } from './application/commands/set-item-availability.usecase';
import { DeleteMenuItemUseCase } from './application/commands/delete-menu-item.usecase';
import { CreateModifierGroupUseCase } from './application/commands/create-modifier-group.usecase';
import { ListModifierGroupsUseCase } from './application/queries/list-modifier-groups.usecase';
import { GetModifierGroupUseCase } from './application/queries/get-modifier-group.usecase';
import { UpdateModifierGroupUseCase } from './application/commands/update-modifier-group.usecase';
import { DeleteModifierGroupUseCase } from './application/commands/delete-modifier-group.usecase';
import { AddModifierOptionUseCase } from './application/commands/add-modifier-option.usecase';
import { UpdateModifierOptionUseCase } from './application/commands/update-modifier-option.usecase';
import { DeleteModifierOptionUseCase } from './application/commands/delete-modifier-option.usecase';
import { ReorderModifierOptionsUseCase } from './application/commands/reorder-modifier-options.usecase';
import { AttachModifierGroupToDishUseCase } from './application/commands/add-modifier-group.usecase';
import { DetachModifierGroupFromDishUseCase } from './application/commands/detach-modifier-group.usecase';
import { SetDishModifierOverridesUseCase } from './application/commands/set-dish-modifier-overrides.usecase';
import { ReorderDishModifierGroupsUseCase } from './application/commands/reorder-dish-modifier-groups.usecase';
import { GetMenuTreeUseCase } from './application/queries/get-menu-tree.usecase';

import { PrismaMenuCategoryRepository } from './infrastructure/persistence/prisma-menu-category.repository';
import { PrismaMenuItemRepository } from './infrastructure/persistence/prisma-menu-item.repository';
import { PrismaModifierGroupRepository } from './infrastructure/persistence/prisma-modifier-group.repository';
import { PrismaModifierOptionRepository } from './infrastructure/persistence/prisma-modifier-option.repository';
import { PrismaDishModifierGroupRepository } from './infrastructure/persistence/prisma-dish-modifier-group.repository';
import { PrismaMenuTreeReader } from './infrastructure/persistence/prisma-menu-tree.reader';
import { PrismaFiscalDepartmentReader } from './infrastructure/persistence/prisma-fiscal-department.reader';

import { MenuController } from './presentation/http/menu.controller';
import { CategoriesController } from './presentation/http/categories.controller';
import { ItemsController } from './presentation/http/items.controller';
import { ModifierGroupsController } from './presentation/http/modifier-groups.controller';

/**
 * Menu module (operational, tenant-scoped by restaurantId). Reads require auth;
 * writes require MENU_MANAGE (enforced in controllers via @RequirePermissions).
 * Imports IdentityModule to reuse ID_GENERATOR.
 */
@Module({
  imports: [IdentityModule, MediaModule],
  controllers: [MenuController, CategoriesController, ItemsController, ModifierGroupsController],
  providers: [
    // categories
    ListCategoriesUseCase,
    CreateCategoryUseCase,
    UpdateCategoryUseCase,
    SetCategoryStatusUseCase,
    ReorderCategoriesUseCase,
    DeleteCategoryUseCase,
    // items
    ListMenuItemsUseCase,
    GetMenuItemUseCase,
    CreateMenuItemUseCase,
    UpdateMenuItemUseCase,
    ChangeItemPriceUseCase,
    SetItemStatusUseCase,
    SetItemAvailabilityUseCase,
    DeleteMenuItemUseCase,
    // reusable modifier groups + options (Prompt 1A)
    CreateModifierGroupUseCase,
    ListModifierGroupsUseCase,
    GetModifierGroupUseCase,
    UpdateModifierGroupUseCase,
    DeleteModifierGroupUseCase,
    AddModifierOptionUseCase,
    UpdateModifierOptionUseCase,
    DeleteModifierOptionUseCase,
    ReorderModifierOptionsUseCase,
    // dish ↔ group attachments
    AttachModifierGroupToDishUseCase,
    DetachModifierGroupFromDishUseCase,
    SetDishModifierOverridesUseCase,
    ReorderDishModifierGroupsUseCase,
    // consumption read model
    GetMenuTreeUseCase,

    // port -> implementation bindings
    { provide: MENU_CATEGORY_REPOSITORY, useClass: PrismaMenuCategoryRepository },
    { provide: MENU_ITEM_REPOSITORY, useClass: PrismaMenuItemRepository },
    { provide: MODIFIER_GROUP_REPOSITORY, useClass: PrismaModifierGroupRepository },
    { provide: MODIFIER_OPTION_REPOSITORY, useClass: PrismaModifierOptionRepository },
    { provide: DISH_MODIFIER_GROUP_REPOSITORY, useClass: PrismaDishModifierGroupRepository },
    { provide: MENU_TREE_READER, useClass: PrismaMenuTreeReader },
    // FISCAL-DEPT-1: validates a dish's assigned `dep` against its branch's departments.
    { provide: FISCAL_DEPARTMENT_READER, useClass: PrismaFiscalDepartmentReader },
  ],
})
export class MenuModule {}
