/**
 * CATALOG-1 platform-catalog seed data (ADR §2–§4, §10).
 *
 * Platform-defined reference data (global, NOT tenant-scoped), mirroring the CX-1
 * consumer taxonomy: deterministic uuidv5 ids from stable slugs, per-column
 * hy/ru/en. Seeded by inert Prisma upsert (no invariant to exercise) in phase 14.
 *
 *   - ALLERGENS         — the EU-14 fixed set the CatalogItems tag against.
 *   - CATALOG_CATEGORIES— a small curator taxonomy items group under.
 *   - CATALOG_ITEMS     — starter curated templates; the full curated set is
 *                         managed by platform-admin later (CATALOG-2).
 *   - CATALOG_ADOPTIONS — links a handful of seeded InventoryItems to a catalog
 *                         item BY REFERENCE, incl. one override, to exercise §3.
 */
import { seedId } from '../ids';

export interface AllergenSeed {
  id: string;
  slug: string;
  labelHy: string;
  labelRu: string;
  labelEn: string;
  position: number;
}

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
  allergenSlugs: string[];
  /** CATALOG-3-SUPPORT: platform-support tagging gate. Seeded true for a few items. */
  reviewed: boolean;
}

export function allergenSeedId(slug: string): string {
  return seedId(`allergen:${slug}`);
}
export function catalogCategorySeedId(slug: string): string {
  return seedId(`catalogcat:${slug}`);
}
export function catalogItemSeedId(slug: string): string {
  return seedId(`catalogitem:${slug}`);
}

/** The EU-14 mandatory allergen set. */
export const ALLERGENS: AllergenSeed[] = [
  ['cereals-gluten', 'Հացահատիկներ (գլյուտեն)', 'Злаки (глютен)', 'Cereals containing gluten'],
  ['crustaceans', 'Խեցգետնանմաններ', 'Ракообразные', 'Crustaceans'],
  ['eggs', 'Ձու', 'Яйца', 'Eggs'],
  ['fish', 'Ձուկ', 'Рыба', 'Fish'],
  ['peanuts', 'Գետնանուշ', 'Арахис', 'Peanuts'],
  ['soybeans', 'Սոյա', 'Соя', 'Soybeans'],
  ['milk', 'Կաթ', 'Молоко', 'Milk'],
  ['nuts', 'Ընկուզեղեն', 'Орехи', 'Tree nuts'],
  ['celery', 'Նեխուր', 'Сельдерей', 'Celery'],
  ['mustard', 'Մանանեխ', 'Горчица', 'Mustard'],
  ['sesame', 'Քունջութ', 'Кунжут', 'Sesame seeds'],
  ['sulphites', 'Սուլֆիտներ', 'Сульфиты', 'Sulphur dioxide and sulphites'],
  ['lupin', 'Լյուպին', 'Люпин', 'Lupin'],
  ['molluscs', 'Փափկամարմիններ', 'Моллюски', 'Molluscs'],
].map(([slug, labelHy, labelRu, labelEn], i) => ({
  id: allergenSeedId(slug),
  slug,
  labelHy,
  labelRu,
  labelEn,
  position: i,
}));

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
  allergenSlugs: string[],
  reviewed = false,
): CatalogItemSeed {
  return {
    id: catalogItemSeedId(slug),
    slug,
    nameHy,
    nameRu,
    nameEn,
    categorySlug,
    allergenSlugs,
    reviewed,
  };
}

/** Starter curated templates (platform-admin curates the full set in CATALOG-2). */
export const CATALOG_ITEMS: CatalogItemSeed[] = [
  item('wheat-flour', 'Ցորենի ալյուր', 'Пшеничная мука', 'Wheat flour', 'pantry', ['cereals-gluten']),
  item('rice', 'Բրինձ', 'Рис', 'Rice', 'pantry', [], true),
  item('vermicelli', 'Արիշտա', 'Вермишель', 'Vermicelli', 'pantry', ['cereals-gluten']),
  item('tomato-paste', 'Տոմատի մածուկ', 'Томатная паста', 'Tomato paste', 'pantry', []),
  item('sunflower-oil', 'Արևածաղկի յուղ', 'Подсолнечное масло', 'Sunflower oil', 'pantry', []),
  item('chickpeas', 'Սիսեռ', 'Нут', 'Chickpeas', 'pantry', []),
  item('butter', 'Կարագ', 'Сливочное масло', 'Butter', 'dairy', ['milk'], true),
  item('matsun', 'Մածուն', 'Мацун', 'Matsun (yogurt)', 'dairy', ['milk']),
  item('lori-cheese', 'Լոռի պանիր', 'Сыр Лори', 'Lori cheese', 'dairy', ['milk']),
  item('string-cheese', 'Չեչիլ պանիր', 'Сыр чечил', 'String cheese', 'dairy', ['milk']),
  item('egg', 'Ձու', 'Яйцо', 'Egg', 'produce', ['eggs']),
  item('walnuts', 'Ընկույզ', 'Грецкие орехи', 'Walnuts', 'nuts-seeds', ['nuts']),
  item('coffee-beans', 'Սուրճի հատիկ', 'Кофейные зёрна', 'Coffee beans', 'beverage', []),
  item('areni-red-wine', 'Արենի կարմիր գինի', 'Красное вино Арени', 'Areni red wine', 'beverage', ['sulphites']),
  // CATALOG-3 verification: a reviewed, no-allergen leaf reached via a produced item.
  item('pork-leg', 'Խոզի բուդ', 'Свиная нога', 'Pork leg', 'meat', [], true),
];

/**
 * Adoption demo (exercises ADR §3). Each entry links a seeded InventoryItem (by its
 * inventory slug, in BOTH branches) to a CatalogItem by reference. `allergenOverride`
 * undefined ⇒ no override (resolve from the catalog); a present array ⇒ tenant
 * override that WINS. Guarded so it is a no-op if the inventory item is absent.
 */
export interface CatalogAdoptionSeed {
  inventorySlug: string;
  catalogSlug: string;
  allergenOverride?: string[];
}

export const CATALOG_ADOPTIONS: CatalogAdoptionSeed[] = [
  { inventorySlug: 'flour', catalogSlug: 'wheat-flour' },
  { inventorySlug: 'walnuts', catalogSlug: 'walnuts' },
  { inventorySlug: 'butter', catalogSlug: 'butter' },
  { inventorySlug: 'egg', catalogSlug: 'egg' },
  // Precedence demo: the tenant asserts BOTH gluten and eggs on their vermicelli,
  // overriding the catalog (which tags gluten only). Override wins (ADR §3).
  { inventorySlug: 'vermicelli', catalogSlug: 'vermicelli', allergenOverride: ['cereals-gluten', 'eggs'] },
  // CATALOG-3 verification fixtures (reviewed, no-override): drive verified rollups.
  { inventorySlug: 'pork-leg', catalogSlug: 'pork-leg' },
  { inventorySlug: 'rice', catalogSlug: 'rice' },
];
