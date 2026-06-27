/**
 * Catalog bundle (BR-6) — the portable JSON document produced by export and
 * consumed by import/clone. Every record carries its own stable `key` plus
 * key-based references to other records. NO cuids appear anywhere in a bundle,
 * so it is portable across branches and restaurants.
 *
 * Pure types — no framework, no Prisma.
 */

import { InventoryBaseUnit, ItemKind } from '../../inventory/domain/enums';
import {
  ItemAvailability,
  MenuStatus,
  ModifierSelectionType,
  PreparationStation,
} from '../../menu/domain/enums';

/** Which sections to export/import. Omitting `include` means all of them. */
export type CatalogSection = 'menu' | 'inventory' | 'recipes' | 'processes';

export const ALL_CATALOG_SECTIONS: readonly CatalogSection[] = [
  'menu',
  'inventory',
  'recipes',
  'processes',
];

/** Current bundle format + payload schema version (bump on breaking change). */
export const CATALOG_BUNDLE_VERSION = 1 as const;
export const CATALOG_SCHEMA_VERSION = 1 as const;

// ── Inventory records ────────────────────────────────────────────────────────

export interface BundleAlternateUnit {
  name: string;
  factor: number;
}

export interface BundleInventoryCategory {
  /** slug(name) */
  key: string;
  name: string;
}

export interface BundleSupplier {
  /** slug(name) */
  key: string;
  name: string;
  contact: string | null;
  note: string | null;
}

export interface BundleInventoryItem {
  /** sku when present, else slug(name) */
  key: string;
  name: string;
  sku: string | null;
  /** key of a BundleInventoryCategory, or null */
  categoryKey: string | null;
  kind: ItemKind;
  baseUnit: InventoryBaseUnit;
  alternateUnits: BundleAlternateUnit[];
  trackExpiry: boolean;
  lowStockThresholdBase: number | null;
}

export interface BundleProcessInput {
  /** key of a BundleInventoryItem */
  itemKey: string;
  baseQty: number;
}

export interface BundleProcessOutput {
  /** key of a BundleInventoryItem */
  itemKey: string;
  baseQty: number;
  isPrimary: boolean;
  costShareBps: number | null;
}

export interface BundleProcess {
  /** slug(name) */
  key: string;
  name: string;
  processingCostAmount: number;
  note: string | null;
  inputs: BundleProcessInput[];
  outputs: BundleProcessOutput[];
}

// ── Menu records ─────────────────────────────────────────────────────────────

export interface BundleMenuCategory {
  /** persisted per-branch code */
  key: string;
  name: string;
  description: string | null;
  displayOrder: number;
}

export interface BundleModifierOption {
  /** slug(name), unique within the group */
  key: string;
  name: string;
  priceDeltaAmount: number;
  displayOrder: number;
}

export interface BundleModifierGroup {
  /** slug(name), unique within the menu item */
  key: string;
  name: string;
  selectionType: ModifierSelectionType;
  required: boolean;
  minSelect: number | null;
  maxSelect: number | null;
  displayOrder: number;
  options: BundleModifierOption[];
}

export interface BundleMenuItem {
  /** persisted per-branch code */
  key: string;
  /** key of a BundleMenuCategory */
  categoryKey: string;
  name: string;
  description: string | null;
  priceAmount: number;
  prepStation: PreparationStation;
  prepTimeMinutes: number | null;
  status: MenuStatus;
  availability: ItemAvailability;
  modifierGroups: BundleModifierGroup[];
}

// ── Recipe records ───────────────────────────────────────────────────────────

export interface BundleRecipeLine {
  /** key of a BundleInventoryItem */
  itemKey: string;
  baseQty: number;
}

export interface BundleModifierConsumption {
  /** key of the owning menu item's modifier group */
  groupKey: string;
  /** key of the option within that group */
  optionKey: string;
  /** key of a BundleInventoryItem */
  itemKey: string;
  baseQty: number;
}

export interface BundleRecipe {
  /** key (code) of the owning BundleMenuItem */
  menuItemKey: string;
  note: string | null;
  lines: BundleRecipeLine[];
  modifierConsumptions: BundleModifierConsumption[];
}

// ── Sections + envelope ──────────────────────────────────────────────────────

export interface CatalogBundleSections {
  inventoryCategories: BundleInventoryCategory[];
  suppliers: BundleSupplier[];
  inventoryItems: BundleInventoryItem[];
  processes: BundleProcess[];
  menuCategories: BundleMenuCategory[];
  menuItems: BundleMenuItem[];
  recipes: BundleRecipe[];
}

export interface CatalogBundleSource {
  restaurantId: string;
  branchId: string;
  exportedAt: string;
}

export interface CatalogBundle {
  version: typeof CATALOG_BUNDLE_VERSION;
  schemaVersion: typeof CATALOG_SCHEMA_VERSION;
  source: CatalogBundleSource;
  sections: CatalogBundleSections;
}

/** An empty section set (used as a base when building a partial bundle). */
export function emptySections(): CatalogBundleSections {
  return {
    inventoryCategories: [],
    suppliers: [],
    inventoryItems: [],
    processes: [],
    menuCategories: [],
    menuItems: [],
    recipes: [],
  };
}
