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
  // BR-9: the table's branch (tables are branch-scoped). The QR app uses the
  // branch slug to fetch that location's own menu/prices.
  branchId: string;
  branchName: string;
  branchSlug: string;
}

export interface PublicBranchInfo {
  id: string;
  name: string;
  slug: string;
}

/**
 * Read-side query for the PUBLIC storefront. Implemented in infrastructure using
 * PrismaService directly (allowed for read models, like reports). Every method is
 * scoped to the resolved restaurantId — public-safe fields only (no users, costs,
 * audit, internal notes, or other restaurants' data). Amounts are integer minor units.
 */
export interface PublicStorefrontQuery {
  restaurantInfo(restaurantId: string): Promise<PublicRestaurantInfo | null>;
  /** BR-9: menu for a SPECIFIC branch (branch-owned catalog per BR-2). */
  menuTree(restaurantId: string, branchId: string): Promise<PublicMenuCategory[]>;
  /** BR-9: the table's info INCLUDING its branch (tables are branch-scoped). */
  tableByQr(restaurantId: string, qrIdentifier: string): Promise<PublicTableInfo | null>;
  /** BR-9: active (non-deleted) branches for the public location picker. */
  activeBranches(restaurantId: string): Promise<PublicBranchInfo[]>;
  /** BR-9: the restaurant's default branch id (fallback for branch-less entries). */
  defaultBranchId(restaurantId: string): Promise<string | null>;
}
