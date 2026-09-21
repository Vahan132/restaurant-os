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

/** Curator categories items group under. */
export const CATALOG_CATEGORIES: CatalogCategorySeed[] = [
  ['produce', 'Բանջարեղեն և մրգեր', 'Овощи и фрукты', 'Produce'],
  ['dairy', 'Կաթնամթերք', 'Молочные продукты', 'Dairy'],
  ['meat', 'Միս', 'Мясо', 'Meat'],
  ['pantry', 'Մթերանոց', 'Бакалея', 'Pantry'],
  ['beverage', 'Ըմպելիքներ', 'Напитки', 'Beverages'],
  ['nuts-seeds', 'Ընկուզեղեն և սերմեր', 'Орехи и семена', 'Nuts & seeds'],
].map(([slug, labelHy, labelRu, labelEn], i) => ({
  id: catalogCategorySeedId(slug),
  slug,
  labelHy,
  labelRu,
  labelEn,
  position: i,
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

/** Starter curated templates (platform-admin curates the full set in CATALOG-2). */
export const CATALOG_ITEMS: CatalogItemSeed[] = [
  item('wheat-flour', 'Ցորենի ալյուր', 'Пшеничная мука', 'Wheat flour', 'pantry'),
  item('rice', 'Բրինձ', 'Рис', 'Rice', 'pantry'),
  item('vermicelli', 'Արիշտա', 'Вермишель', 'Vermicelli', 'pantry'),
  item('tomato-paste', 'Տոմատի մածուկ', 'Томатная паста', 'Tomato paste', 'pantry'),
  item('sunflower-oil', 'Արևածաղկի յուղ', 'Подсолнечное масло', 'Sunflower oil', 'pantry'),
  item('chickpeas', 'Սիսեռ', 'Нут', 'Chickpeas', 'pantry'),
  item('butter', 'Կարագ', 'Сливочное масло', 'Butter', 'dairy'),
  item('matsun', 'Մածուն', 'Мацун', 'Matsun (yogurt)', 'dairy'),
  item('lori-cheese', 'Լոռի պանիր', 'Сыр Лори', 'Lori cheese', 'dairy'),
  item('string-cheese', 'Չեչիլ պանիր', 'Сыр чечил', 'String cheese', 'dairy'),
  item('egg', 'Ձու', 'Яйцо', 'Egg', 'produce'),
  item('walnuts', 'Ընկույզ', 'Грецкие орехи', 'Walnuts', 'nuts-seeds'),
  item('coffee-beans', 'Սուրճի հատիկ', 'Кофейные зёрна', 'Coffee beans', 'beverage'),
  item('areni-red-wine', 'Արենի կարմիր գինի', 'Красное вино Арени', 'Areni red wine', 'beverage'),
  // CATALOG-3 verification: a leaf reached via a produced item.
  item('pork-leg', 'Խոզի բուդ', 'Свиная нога', 'Pork leg', 'meat'),
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
