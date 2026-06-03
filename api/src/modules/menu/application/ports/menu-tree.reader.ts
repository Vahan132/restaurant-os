export const MENU_TREE_READER = Symbol('MenuTreeReader');

export interface MenuTreeOption {
  id: string;
  name: string;
  priceDeltaAmount: number;
  displayOrder: number;
}

export interface MenuTreeGroup {
  id: string;
  name: string;
  selectionType: string;
  required: boolean;
  minSelect: number | null;
  maxSelect: number | null;
  displayOrder: number;
  options: MenuTreeOption[];
}

export interface MenuTreeItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceAmount: number;
  imageUrl: string | null;
  preparationStation: string;
  prepTimeMinutes: number | null;
  availability: string;
  modifierGroups: MenuTreeGroup[];
}

export interface MenuTreeCategory {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
  items: MenuTreeItem[];
}

/**
 * Read model for POS/KDS/QR. Returns ACTIVE categories (ordered) -> ACTIVE items
 * (ordered) with their ACTIVE modifier groups/options. INACTIVE and soft-deleted
 * rows are always excluded. `includeUnavailable` keeps UNAVAILABLE items in the
 * tree (shown but flagged) when true. Implemented in infrastructure.
 */
export interface MenuTreeReader {
  getTree(restaurantId: string, includeUnavailable: boolean): Promise<MenuTreeCategory[]>;
}
