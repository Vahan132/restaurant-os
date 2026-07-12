import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

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

/**
 * PLATCAT-ADOPT-1B: an adopted item's name is owned by the platform catalog and is
 * not tenant-editable (it resolves the catalog name live). Raised when an update
 * tries to set/clear `name` on an item that has a catalogItemId.
 */
export const InventoryItemNamePlatformOwned = () =>
  new ConflictException({
    code: 'INVENTORY_ITEM_NAME_PLATFORM_OWNED',
    message:
      'This item was adopted from the platform catalog; its name is owned by the ' +
      'catalog and cannot be edited here.',
  });

export const InventoryCategoryNotFound = () =>
  new NotFoundException({
    code: 'INVENTORY_CATEGORY_NOT_FOUND',
    message: 'Inventory category not found.',
  });

/** CATALOG-1 adopt: the referenced platform CatalogItem does not exist. */
export const CatalogItemNotFound = () =>
  new NotFoundException({ code: 'CATALOG_ITEM_NOT_FOUND', message: 'Catalog item not found.' });

/** CATALOG-1 adopt: the CatalogItem exists but is archived (not adoptable). */
export const CatalogItemNotAdoptable = () =>
  new BadRequestException({
    code: 'CATALOG_ITEM_NOT_ADOPTABLE',
    message: 'This catalog item is archived and cannot be adopted.',
  });

/** CATALOG-1 adopt: this branch already adopted this CatalogItem. */
export const CatalogItemAlreadyAdopted = (existingItemId: string) =>
  new ConflictException({
    code: 'CATALOG_ITEM_ALREADY_ADOPTED',
    message: 'This catalog item has already been adopted in this branch.',
    details: { existingItemId },
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

// ── 6A multi-location ────────────────────────────────────────────────────────

export const InventoryLocationNotFound = () =>
  new NotFoundException({
    code: 'INVENTORY_LOCATION_NOT_FOUND',
    message: 'Inventory location not found.',
  });

export const DuplicateLocationName = () =>
  new ConflictException({
    code: 'INVENTORY_LOCATION_NAME_EXISTS',
    message: 'A location with this name already exists in this branch.',
  });

export const CannotDeleteSystemLocation = () =>
  new ConflictException({
    code: 'INVENTORY_SYSTEM_LOCATION_UNDELETABLE',
    message: 'System locations (Main Storage, Kitchen, Bar) cannot be deleted.',
  });

export const LocationNotEmpty = () =>
  new ConflictException({
    code: 'INVENTORY_LOCATION_NOT_EMPTY',
    message: 'A location can only be deleted when it holds no stock.',
  });

/** Raised only on manual/admin depletions under a BLOCK policy (§5). */
export const NegativeStockBlocked = () =>
  new ConflictException({
    code: 'NEGATIVE_STOCK_BLOCKED',
    message: 'This change would drive on-hand below zero and the branch policy is BLOCK.',
  });

// ── 6B transfers ─────────────────────────────────────────────────────────────

export const TransferSameLocation = () =>
  new BadRequestException({
    code: 'TRANSFER_SAME_LOCATION',
    message: 'Source and destination locations must be different.',
  });

export const TransferLocationInactive = () =>
  new ConflictException({
    code: 'TRANSFER_LOCATION_INACTIVE',
    message: 'Both the source and destination locations must be active.',
  });

export const TransferExceedsOnHand = () =>
  new ConflictException({
    code: 'TRANSFER_EXCEEDS_ON_HAND',
    message: 'Transfer quantity exceeds the on-hand at the source location.',
  });

export const TransferNotFound = () =>
  new NotFoundException({ code: 'TRANSFER_NOT_FOUND', message: 'Transfer not found.' });

// ── 6D reports ───────────────────────────────────────────────────────────────

/** The caller asked for a branch outside their permitted reach. */
export const BranchAccessForbidden = () =>
  new ForbiddenException({
    code: 'BRANCH_ACCESS_FORBIDDEN',
    message: 'You do not have access to the requested branch.',
  });
