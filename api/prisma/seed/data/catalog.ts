/**
 * CATALOG-1 platform-catalog seed data (ADR §2–§4, §10).
 *
 * Platform-defined reference data (global, NOT tenant-scoped), mirroring the CX-1
 * consumer taxonomy: deterministic uuidv5 ids from stable slugs, per-column
 * hy/ru/en. Seeded by inert Prisma upsert (no invariant to exercise) in phase 14.
 *
 *   - CATALOG_CATEGORIES— a small curator taxonomy items group under.
 *   - CATALOG_ITEMS     — starter curated templates; the full curated set is
 *                         managed by platform-admin later (CATALOG-2).
 *   - CATALOG_ADOPTIONS — links a handful of seeded InventoryItems to a catalog
 *                         item BY REFERENCE, to exercise §3.
 */
import { seedId } from '../ids';

export interface CatalogCategorySeed {
  id: string;
  slug: string;
  labelHy: string;
  labelRu: string;
  labelEn: string;
  position: number;
}

export interface CatalogItemSeed {
  id: string;
  slug: string;
  nameHy: string;
  nameRu: string;
  nameEn: string;
  categorySlug: string;
}

export function catalogCategorySeedId(slug: string): string {
  return seedId(`catalogcat:${slug}`);
}
export function catalogItemSeedId(slug: string): string {
  return seedId(`catalogitem:${slug}`);
}

/**
 * Demo-only categories NOT covered by the kitchen catalog (CATALOG-4). Every food
 * category/item now lives in ./kitchen-catalog.ts (seeded by seedKitchenCatalog);
 * drinks are intentionally not part of the kitchen catalog.
 */
export const CATALOG_CATEGORIES: CatalogCategorySeed[] = [
  ['beverage', 'Ըմպելիքներ', 'Напитки', 'Beverages'],
].map(([slug, labelHy, labelRu, labelEn]) => ({
  id: catalogCategorySeedId(slug!),
  slug: slug!,
  labelHy: labelHy!,
  labelRu: labelRu!,
  labelEn: labelEn!,
  position: 100,
}));

function item(
  slug: string,
  nameHy: string,
  nameRu: string,
  nameEn: string,
  categorySlug: string,
): CatalogItemSeed {
  return { id: catalogItemSeedId(slug), slug, nameHy, nameRu, nameEn, categorySlug };
}

/** Demo-only items outside the kitchen catalog (drinks used by the demo restaurant). */
export const CATALOG_ITEMS: CatalogItemSeed[] = [
  item('coffee-beans', 'Սուրճի հատիկ', 'Кофейные зёрна', 'Coffee beans', 'beverage'),
  item('areni-red-wine', 'Արենի կարմիր գինի', 'Красное вино Арени', 'Areni red wine', 'beverage'),
];

/**
 * Adoption demo (exercises ADR §3). Each entry links a seeded InventoryItem (by its
 * inventory slug, in BOTH branches) to a CatalogItem by reference. Guarded so it is
 * a no-op if the inventory item is absent.
 */
export interface CatalogAdoptionSeed {
  inventorySlug: string;
  catalogSlug: string;
}

export const CATALOG_ADOPTIONS: CatalogAdoptionSeed[] = [
  { inventorySlug: 'flour', catalogSlug: 'wheat-flour' },
  { inventorySlug: 'walnuts', catalogSlug: 'walnuts' },
  { inventorySlug: 'butter', catalogSlug: 'butter' },
  { inventorySlug: 'egg', catalogSlug: 'egg' },
  { inventorySlug: 'vermicelli', catalogSlug: 'vermicelli' },
  { inventorySlug: 'pork-leg', catalogSlug: 'pork-leg' },
  { inventorySlug: 'rice', catalogSlug: 'rice' },
];
