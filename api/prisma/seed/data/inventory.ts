/**
 * Inventory master + opening balances (locked decision H).
 *
 * ~50 items per branch across Kitchen / Bar / Main Storage in base units
 * (GRAM / MILLILITER / PIECE). Each item's `home` location is BOTH where its
 * opening stock is laid down AND its consumptionLocationId — so serve-time BOM
 * depletion (6C resolver) always pulls from a stocked location and stays
 * non-negative. Opening quantities are deliberately generous relative to the
 * seeded order volume + process inputs.
 *
 * Opening stock is laid through the REAL goods-receipt use-case (decision B):
 * it produces a StockLayer (FIFO lot) + a RECEIPT_IN StockMovement + the
 * ledger-maintained StockOnHand in one transaction, and refreshes
 * lastUnitCostMicro. (StockMovementType.OPENING exists in the schema but is
 * written by no use-case/gateway — RECEIPT_IN via goods-receipt is the real
 * opening-balance path; noted in the verification report.)
 *
 * `costPerBase` = AMD (whole dram) per base unit. lineTotalCostAmount per receipt
 * line = round(openingQtyBase * costPerBase).
 */
export type LocationKey = 'KITCHEN' | 'BAR' | 'MAIN_STORAGE';
export type BaseUnit = 'GRAM' | 'MILLILITER' | 'PIECE';
export type ItemKind = 'RAW' | 'PROCESSED';

export interface ItemSeed {
  slug: string;
  name: string; // hy
  nameEn: string;
  home: LocationKey;
  baseUnit: BaseUnit;
  kind: ItemKind;
  /** Opening stock in base units (0 for PROCESSED outputs, produced by a run). */
  openingQtyBase: number;
  /** AMD (dram) per base unit. */
  costPerBase: number;
}

export const ITEMS: ItemSeed[] = [
  // ── Main Storage (dry / bulk) ──────────────────────────────────────────────
  { slug: 'flour', name: 'Ալյուր', nameEn: 'Flour', home: 'MAIN_STORAGE', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 60000, costPerBase: 0.25 },
  { slug: 'rice', name: 'Բրինձ', nameEn: 'Rice', home: 'MAIN_STORAGE', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 40000, costPerBase: 0.5 },
  { slug: 'bulgur', name: 'Ձավար (բուլղուր)', nameEn: 'Bulgur', home: 'MAIN_STORAGE', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 30000, costPerBase: 0.45 },
  { slug: 'salt', name: 'Աղ', nameEn: 'Salt', home: 'MAIN_STORAGE', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 20000, costPerBase: 0.1 },
  { slug: 'sugar', name: 'Շաքարավազ', nameEn: 'Sugar', home: 'MAIN_STORAGE', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 25000, costPerBase: 0.35 },
  { slug: 'black-pepper', name: 'Սև պղպեղ', nameEn: 'Black pepper', home: 'MAIN_STORAGE', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 3000, costPerBase: 8 },
  { slug: 'paprika', name: 'Կարմիր պղպեղ', nameEn: 'Paprika', home: 'MAIN_STORAGE', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 3000, costPerBase: 6 },
  { slug: 'dried-mint', name: 'Չորացրած անանուխ', nameEn: 'Dried mint', home: 'MAIN_STORAGE', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 2000, costPerBase: 10 },
  { slug: 'sunflower-oil', name: 'Արևածաղկի յուղ', nameEn: 'Sunflower oil', home: 'MAIN_STORAGE', baseUnit: 'MILLILITER', kind: 'RAW', openingQtyBase: 40000, costPerBase: 0.5 },
  { slug: 'olive-oil', name: 'Ձիթապտղի յուղ', nameEn: 'Olive oil', home: 'MAIN_STORAGE', baseUnit: 'MILLILITER', kind: 'RAW', openingQtyBase: 15000, costPerBase: 3 },
  { slug: 'tomato-paste', name: 'Տոմատի մածուկ', nameEn: 'Tomato paste', home: 'MAIN_STORAGE', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 20000, costPerBase: 1.2 },
  { slug: 'chickpeas', name: 'Սիսեռ', nameEn: 'Chickpeas', home: 'MAIN_STORAGE', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 20000, costPerBase: 0.6 },
  { slug: 'red-lentils', name: 'Կարմիր ոսպ', nameEn: 'Red lentils', home: 'MAIN_STORAGE', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 20000, costPerBase: 0.55 },
  { slug: 'walnuts', name: 'Ընկույզ', nameEn: 'Walnuts', home: 'MAIN_STORAGE', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 10000, costPerBase: 5 },
  { slug: 'raisins', name: 'Չամիչ', nameEn: 'Raisins', home: 'MAIN_STORAGE', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 8000, costPerBase: 3 },
  { slug: 'vermicelli', name: 'Արիշտա', nameEn: 'Vermicelli', home: 'MAIN_STORAGE', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 10000, costPerBase: 0.6 },
  { slug: 'pomegranate-sauce', name: 'Նռան սոուս', nameEn: 'Pomegranate sauce', home: 'MAIN_STORAGE', baseUnit: 'MILLILITER', kind: 'RAW', openingQtyBase: 8000, costPerBase: 2.5 },
  { slug: 'dried-apricot', name: 'Չիր (ծիրան)', nameEn: 'Dried apricot', home: 'MAIN_STORAGE', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 8000, costPerBase: 4 },

  // ── Kitchen (perishable) ───────────────────────────────────────────────────
  { slug: 'pork-leg', name: 'Խոզի բուդ', nameEn: 'Pork leg', home: 'KITCHEN', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 60000, costPerBase: 2.2 },
  { slug: 'pork-loin', name: 'Խոզի կողիկ', nameEn: 'Pork loin', home: 'KITCHEN', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 40000, costPerBase: 2.6 },
  { slug: 'beef', name: 'Տավարի միս', nameEn: 'Beef', home: 'KITCHEN', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 40000, costPerBase: 3.0 },
  { slug: 'lamb', name: 'Գառան միս', nameEn: 'Lamb', home: 'KITCHEN', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 30000, costPerBase: 3.2 },
  { slug: 'chicken', name: 'Հավի միս', nameEn: 'Chicken', home: 'KITCHEN', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 50000, costPerBase: 1.8 },
  { slug: 'ground-beef', name: 'Աղացած տավարի միս', nameEn: 'Ground beef', home: 'KITCHEN', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 30000, costPerBase: 2.8 },
  { slug: 'potato', name: 'Կարտոֆիլ', nameEn: 'Potato', home: 'KITCHEN', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 60000, costPerBase: 0.3 },
  { slug: 'onion', name: 'Սոխ', nameEn: 'Onion', home: 'KITCHEN', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 40000, costPerBase: 0.25 },
  { slug: 'tomato', name: 'Պոմիդոր', nameEn: 'Tomato', home: 'KITCHEN', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 40000, costPerBase: 0.6 },
  { slug: 'cucumber', name: 'Վարունգ', nameEn: 'Cucumber', home: 'KITCHEN', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 25000, costPerBase: 0.5 },
  { slug: 'bell-pepper', name: 'Բիբար', nameEn: 'Bell pepper', home: 'KITCHEN', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 20000, costPerBase: 0.7 },
  { slug: 'eggplant', name: 'Սմբուկ', nameEn: 'Eggplant', home: 'KITCHEN', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 25000, costPerBase: 0.55 },
  { slug: 'garlic', name: 'Սխտոր', nameEn: 'Garlic', home: 'KITCHEN', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 8000, costPerBase: 2 },
  { slug: 'parsley', name: 'Մաղադանոս', nameEn: 'Parsley', home: 'KITCHEN', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 5000, costPerBase: 1.5 },
  { slug: 'cilantro', name: 'Համեմ', nameEn: 'Cilantro', home: 'KITCHEN', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 5000, costPerBase: 1.5 },
  { slug: 'lemon', name: 'Կիտրոն', nameEn: 'Lemon', home: 'KITCHEN', baseUnit: 'PIECE', kind: 'RAW', openingQtyBase: 300, costPerBase: 120 },
  { slug: 'egg', name: 'Ձու', nameEn: 'Egg', home: 'KITCHEN', baseUnit: 'PIECE', kind: 'RAW', openingQtyBase: 600, costPerBase: 90 },
  { slug: 'butter', name: 'Կարագ', nameEn: 'Butter', home: 'KITCHEN', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 15000, costPerBase: 2.5 },
  { slug: 'matsun', name: 'Մածուն', nameEn: 'Matsun (yogurt)', home: 'KITCHEN', baseUnit: 'MILLILITER', kind: 'RAW', openingQtyBase: 20000, costPerBase: 0.8 },
  { slug: 'lori-cheese', name: 'Լոռի պանիր', nameEn: 'Lori cheese', home: 'KITCHEN', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 20000, costPerBase: 2.8 },
  { slug: 'string-cheese', name: 'Չեչիլ պանիր', nameEn: 'String cheese', home: 'KITCHEN', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 10000, costPerBase: 3.5 },
  { slug: 'carrot', name: 'Գազար', nameEn: 'Carrot', home: 'KITCHEN', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 20000, costPerBase: 0.3 },

  // ── Bar (drinks) ───────────────────────────────────────────────────────────
  { slug: 'cola', name: 'Կոլա', nameEn: 'Cola', home: 'BAR', baseUnit: 'MILLILITER', kind: 'RAW', openingQtyBase: 30000, costPerBase: 0.4 },
  { slug: 'tarragon-lemonade', name: 'Թարխունի լիմոնադ', nameEn: 'Tarragon lemonade', home: 'BAR', baseUnit: 'MILLILITER', kind: 'RAW', openingQtyBase: 25000, costPerBase: 0.5 },
  { slug: 'mineral-water', name: 'Հանքային ջուր (Ջերմուկ)', nameEn: 'Mineral water', home: 'BAR', baseUnit: 'MILLILITER', kind: 'RAW', openingQtyBase: 40000, costPerBase: 0.2 },
  { slug: 'areni-red-wine', name: 'Արենի կարմիր գինի', nameEn: 'Areni red wine', home: 'BAR', baseUnit: 'MILLILITER', kind: 'RAW', openingQtyBase: 20000, costPerBase: 2.0 },
  { slug: 'ararat-cognac', name: 'Արարատ կոնյակ', nameEn: 'Ararat brandy', home: 'BAR', baseUnit: 'MILLILITER', kind: 'RAW', openingQtyBase: 10000, costPerBase: 6.0 },
  { slug: 'coffee-beans', name: 'Սուրճի հատիկ', nameEn: 'Coffee beans', home: 'BAR', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 8000, costPerBase: 7.0 },
  { slug: 'black-tea', name: 'Սև թեյ', nameEn: 'Black tea', home: 'BAR', baseUnit: 'GRAM', kind: 'RAW', openingQtyBase: 3000, costPerBase: 6.0 },
  { slug: 'fruit-compote', name: 'Կոմպոտ', nameEn: 'Fruit compote', home: 'BAR', baseUnit: 'MILLILITER', kind: 'RAW', openingQtyBase: 20000, costPerBase: 0.6 },

  // ── Processed outputs (produced by process runs; no opening stock) ──────────
  { slug: 'marinated-pork-cubes', name: 'Մարինադած խոզի կտորներ', nameEn: 'Marinated pork cubes', home: 'KITCHEN', baseUnit: 'GRAM', kind: 'PROCESSED', openingQtyBase: 0, costPerBase: 0 },
  { slug: 'tomato-sauce', name: 'Տնական տոմատի սոուս', nameEn: 'House tomato sauce', home: 'KITCHEN', baseUnit: 'MILLILITER', kind: 'PROCESSED', openingQtyBase: 0, costPerBase: 0 },
];

export const ITEMS_BY_SLUG: Record<string, ItemSeed> = Object.fromEntries(
  ITEMS.map((i) => [i.slug, i]),
);

/** KDS prep/production processes (locked decision I). Outputs are PROCESSED. */
export interface ProcessSeed {
  slug: string;
  name: string;
  processingCostAmount: number; // AMD
  inputs: Array<{ item: string; baseQty: number }>;
  outputs: Array<{ item: string; baseQty: number; isPrimary: boolean; costShareBps?: number }>;
}

export const PROCESSES: ProcessSeed[] = [
  {
    slug: 'pork-marinade',
    name: 'Խոզի մսի մարինադ (պատրաստում)',
    processingCostAmount: 5000,
    inputs: [{ item: 'pork-leg', baseQty: 10000 }],
    outputs: [{ item: 'marinated-pork-cubes', baseQty: 9000, isPrimary: true }],
  },
  {
    slug: 'tomato-sauce-batch',
    name: 'Տնական տոմատի սոուս (խմբաքանակ)',
    processingCostAmount: 3000,
    inputs: [
      { item: 'tomato', baseQty: 8000 },
      { item: 'onion', baseQty: 2000 },
      { item: 'sunflower-oil', baseQty: 1000 },
    ],
    outputs: [{ item: 'tomato-sauce', baseQty: 9000, isPrimary: true }],
  },
];
