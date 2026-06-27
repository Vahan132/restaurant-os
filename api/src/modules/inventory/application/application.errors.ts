import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

/** Inventory application-level errors (standard error shape). 404 hides cross-tenant resources. */

export const NoRestaurantInScope = () =>
  new BadRequestException({
    code: 'NO_RESTAURANT_IN_SCOPE',
    message: 'Your account is not scoped to a restaurant.',
  });

export const InventoryItemNotFound = () =>
  new NotFoundException({ code: 'INVENTORY_ITEM_NOT_FOUND', message: 'Inventory item not found.' });

export const InventorySkuAlreadyExists = () =>
  new ConflictException({
    code: 'INVENTORY_SKU_ALREADY_EXISTS',
    message: 'An inventory item with this SKU already exists.',
  });

export const InventoryCategoryNotFound = () =>
  new NotFoundException({
    code: 'INVENTORY_CATEGORY_NOT_FOUND',
    message: 'Inventory category not found.',
  });

export const SupplierNotFound = () =>
  new NotFoundException({ code: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found.' });

export const GoodsReceiptNotFound = () =>
  new NotFoundException({ code: 'GOODS_RECEIPT_NOT_FOUND', message: 'Goods receipt not found.' });

export const ProcessNotFound = () =>
  new NotFoundException({ code: 'PROCESS_NOT_FOUND', message: 'Process not found.' });

export const ProcessRunNotFound = () =>
  new NotFoundException({ code: 'PROCESS_RUN_NOT_FOUND', message: 'Process run not found.' });

export const RecipeNotFound = () =>
  new NotFoundException({ code: 'RECIPE_NOT_FOUND', message: 'Recipe not found.' });

export const MenuItemNotFoundForRecipe = () =>
  new NotFoundException({ code: 'MENU_ITEM_NOT_FOUND', message: 'Menu item not found.' });

export const ModifierOptionNotFound = () =>
  new NotFoundException({
    code: 'MODIFIER_OPTION_NOT_FOUND',
    message: 'Modifier option not found.',
  });

export const RecipeAlreadyExists = () =>
  new ConflictException({
    code: 'RECIPE_ALREADY_EXISTS',
    message: 'A recipe already exists for this menu item.',
  });

export const WriteOffNotFound = () =>
  new NotFoundException({ code: 'WRITE_OFF_NOT_FOUND', message: 'Write-off not found.' });

export const CrossBranchReference = (
  message = 'Referenced resource belongs to a different branch.',
) => new BadRequestException({ code: 'VALIDATION_ERROR', message });
