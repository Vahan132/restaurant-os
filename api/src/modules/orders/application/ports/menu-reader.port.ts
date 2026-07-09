export const MENU_READER = Symbol('OrdersMenuReader');

export interface MenuItemForOrder {
  id: string;
  branchId: string;
  /** Internal item code — snapshotted as the fiscal `goodCode` (ORDER-2). */
  code: string;
  /** FISCAL-0: dish-level SRC ATG classifier code, snapshotted as the fiscal line adgCode. Null until classified. */
  adgCode: string | null;
  name: string;
  priceAmount: number;
  preparationStation: string;
  status: string; // MenuStatus
  availability: string; // ItemAvailability
}

export interface ModifierOptionForOrder {
  id: string;
  groupId: string;
  name: string;
  priceDeltaAmount: number;
  status: string;
}

export interface ModifierGroupForOrder {
  id: string;
  name: string;
  selectionType: string; // SINGLE | MULTIPLE
  required: boolean;
  minSelect: number | null;
  maxSelect: number | null;
  options: ModifierOptionForOrder[];
}

export interface MenuItemWithModifiersForOrder {
  item: MenuItemForOrder;
  groups: ModifierGroupForOrder[];
}

/**
 * Reads menu data the orders module needs to snapshot + validate items.
 * Tenant-scoped by restaurantId. Implemented in infrastructure via Prisma.
 */
export interface MenuReader {
  getItemWithModifiers(
    restaurantId: string,
    menuItemId: string,
  ): Promise<MenuItemWithModifiersForOrder | null>;
}
