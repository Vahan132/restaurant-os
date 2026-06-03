export const PUBLIC_STOREFRONT_QUERY = Symbol('PublicStorefrontQuery');

export interface PublicRestaurantInfo {
  name: string;
  logoUrl: string | null;
  currency: string;
  defaultLanguage: string;
  timezone: string;
  address: string | null;
  phone: string | null;
  openingHours: unknown | null;
  orderingEnabled: boolean;
}

export interface PublicModifierOption {
  id: string;
  name: string;
  priceDeltaAmount: number;
}
export interface PublicModifierGroup {
  id: string;
  name: string;
  selectionType: string;
  required: boolean;
  minSelect: number | null;
  maxSelect: number | null;
  options: PublicModifierOption[];
}
export interface PublicMenuItem {
  id: string;
  name: string;
  description: string | null;
  priceAmount: number;
  imageUrl: string | null;
  available: boolean;
  modifierGroups: PublicModifierGroup[];
}
export interface PublicMenuCategory {
  id: string;
  name: string;
  description: string | null;
  items: PublicMenuItem[];
}
export interface PublicTableInfo {
  tableId: string;
  name: string;
  floorName: string | null;
}

/**
 * Read-side query for the PUBLIC storefront. Implemented in infrastructure using
 * PrismaService directly (allowed for read models, like reports). Every method is
 * scoped to the resolved restaurantId — public-safe fields only (no users, costs,
 * audit, internal notes, or other restaurants' data). Amounts are integer minor units.
 */
export interface PublicStorefrontQuery {
  restaurantInfo(restaurantId: string): Promise<PublicRestaurantInfo | null>;
  menuTree(restaurantId: string): Promise<PublicMenuCategory[]>;
  tableByQr(restaurantId: string, qrIdentifier: string): Promise<PublicTableInfo | null>;
}
