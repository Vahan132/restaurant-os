/**
 * Catalog (locked decision G). ~30 dishes across 6 categories with names +
 * descriptions, prices in AMD, plus a small library of reusable modifier groups
 * attached to relevant dishes with per-attachment overrides.
 *
 * LOCALIZATION NOTE (deviation from the prompt, seeded to the REAL shape):
 *   The live schema stores exactly ONE string per name/description — there is NO
 *   translation table or locale/JSON column anywhere in the codebase (verified).
 *   Adding one would be a schema change → a hard stop. So each dish carries hy /
 *   ru / en HERE in the seed source (the data "carries" all three), and the
 *   PRIMARY locale (hy, = restaurant.defaultLanguage) is what persists to
 *   MenuItem.name / .description. ru + en remain in this file as the documented
 *   source of truth. This is the only faithful option without altering the schema.
 */
export type Station = 'KITCHEN' | 'BAR' | 'DESSERT' | 'OTHER';

export interface CategorySeed {
  slug: string;
  name: string; // hy
  nameRu: string;
  nameEn: string;
  order: number;
}

export const CATEGORIES: CategorySeed[] = [
  { slug: 'grill', name: 'Խորոված', nameRu: 'Хоровац (гриль)', nameEn: 'Grill', order: 0 },
  { slug: 'soups', name: 'Ապուրներ', nameRu: 'Супы', nameEn: 'Soups', order: 1 },
  { slug: 'salads', name: 'Աղցաններ', nameRu: 'Салаты', nameEn: 'Salads', order: 2 },
  { slug: 'mains', name: 'Հիմնական ճաշատեսակներ', nameRu: 'Основные блюда', nameEn: 'Main dishes', order: 3 },
  { slug: 'drinks', name: 'Խմիչքներ', nameRu: 'Напитки', nameEn: 'Drinks', order: 4 },
  { slug: 'desserts', name: 'Աղանդեր', nameRu: 'Десерты', nameEn: 'Desserts', order: 5 },
];

export type ModifierGroupKey = 'doneness' | 'spice' | 'side' | 'size' | 'addons';

export interface ModifierOptionSeed {
  slug: string;
  name: string; // hy
  nameRu: string;
  nameEn: string;
  priceDelta: number; // AMD
  isDefault?: boolean;
}

export interface ModifierGroupSeed {
  key: ModifierGroupKey;
  name: string; // hy
  nameRu: string;
  nameEn: string;
  selectionType: 'SINGLE' | 'MULTIPLE';
  required: boolean;
  minSelect: number | null;
  maxSelect: number | null;
  options: ModifierOptionSeed[];
}

export const MODIFIER_GROUPS: ModifierGroupSeed[] = [
  {
    key: 'doneness',
    name: 'Տապակվածության աստիճան',
    nameRu: 'Степень прожарки',
    nameEn: 'Doneness',
    selectionType: 'SINGLE',
    required: true,
    minSelect: 1,
    maxSelect: 1,
    options: [
      { slug: 'rare', name: 'Թույլ', nameRu: 'С кровью', nameEn: 'Rare', priceDelta: 0 },
      { slug: 'medium', name: 'Միջին', nameRu: 'Средняя', nameEn: 'Medium', priceDelta: 0, isDefault: true },
      { slug: 'well', name: 'Լավ տապակած', nameRu: 'Хорошо прожаренная', nameEn: 'Well done', priceDelta: 0 },
    ],
  },
  {
    key: 'spice',
    name: 'Կծվության աստիճան',
    nameRu: 'Острота',
    nameEn: 'Spice level',
    selectionType: 'SINGLE',
    required: false,
    minSelect: 0,
    maxSelect: 1,
    options: [
      { slug: 'mild', name: 'Առանց կծվության', nameRu: 'Без остроты', nameEn: 'Mild', priceDelta: 0, isDefault: true },
      { slug: 'medium-spice', name: 'Միջին', nameRu: 'Средняя', nameEn: 'Medium', priceDelta: 0 },
      { slug: 'hot', name: 'Կծու', nameRu: 'Острая', nameEn: 'Hot', priceDelta: 0 },
    ],
  },
  {
    key: 'side',
    name: 'Կողմնակի ուտեստ',
    nameRu: 'Гарнир',
    nameEn: 'Side choice',
    selectionType: 'SINGLE',
    required: false,
    minSelect: 0,
    maxSelect: 1,
    options: [
      { slug: 'fries', name: 'Կարտոֆիլ ֆրի', nameRu: 'Картофель фри', nameEn: 'French fries', priceDelta: 600, isDefault: true },
      { slug: 'rice-side', name: 'Բրինձ', nameRu: 'Рис', nameEn: 'Rice', priceDelta: 500 },
      { slug: 'grilled-veg', name: 'Գրիլ բանջարեղեն', nameRu: 'Овощи гриль', nameEn: 'Grilled vegetables', priceDelta: 800 },
    ],
  },
  {
    key: 'size',
    name: 'Չափս',
    nameRu: 'Размер',
    nameEn: 'Size',
    selectionType: 'SINGLE',
    required: true,
    minSelect: 1,
    maxSelect: 1,
    options: [
      { slug: 'small', name: 'Փոքր', nameRu: 'Маленький', nameEn: 'Small', priceDelta: 0, isDefault: true },
      { slug: 'large', name: 'Մեծ', nameRu: 'Большой', nameEn: 'Large', priceDelta: 300 },
    ],
  },
  // CATALOG-3/4 verification: an add-on that introduces an allergen (nuts).
  {
    key: 'addons',
    name: 'Հավելումներ',
    nameRu: 'Добавки',
    nameEn: 'Add-ons',
    selectionType: 'MULTIPLE',
    required: false,
    minSelect: 0,
    maxSelect: null,
    options: [
      { slug: 'add-walnuts', name: 'Ընկույզ', nameRu: 'Грецкие орехи', nameEn: 'Add walnuts', priceDelta: 500 },
    ],
  },
];

export interface AttachmentSeed {
  group: ModifierGroupKey;
  /** Per-attachment overrides (null inherits the group's value). */
  requiredOverride?: boolean;
  minOverride?: number;
  maxOverride?: number;
}

export interface RecipeLineSeed {
  item: string; // inventory item slug
  baseQty: number; // base units consumed per dish sold
}

/** Extra inventory drawn when a specific modifier option is chosen (CATALOG-3/4). */
export interface ModifierConsumptionSeed {
  group: ModifierGroupKey;
  option: string; // option slug within the group
  item: string; // inventory item slug
  baseQty: number;
}

export interface DishSeed {
  slug: string;
  category: string;
  name: string; // hy
  nameRu: string;
  nameEn: string;
  descHy: string;
  price: number; // AMD
  station: Station;
  attachments: AttachmentSeed[];
  recipe: RecipeLineSeed[];
  /** Modifier-option-triggered inventory draws (default none). */
  modifierConsumptions?: ModifierConsumptionSeed[];
}

export const DISHES: DishSeed[] = [
  // ── Grill ──────────────────────────────────────────────────────────────────
  {
    slug: 'pork-khorovats', category: 'grill',
    name: 'Խոզի խորոված', nameRu: 'Свиной хоровац', nameEn: 'Pork khorovats',
    descHy: 'Կաղնու ածխի վրա խորոված խոզի մսի կտորներ՝ սոխով։',
    price: 3500, station: 'KITCHEN',
    attachments: [{ group: 'doneness' }, { group: 'spice' }, { group: 'side', requiredOverride: true }],
    recipe: [{ item: 'pork-loin', baseQty: 300 }, { item: 'onion', baseQty: 50 }, { item: 'salt', baseQty: 5 }],
  },
  {
    slug: 'chicken-khorovats', category: 'grill',
    name: 'Հավի խորоված', nameRu: 'Куриный хоровац', nameEn: 'Chicken khorovats',
    descHy: 'Մարինադած հավի խորоված՝ թարմ խոտաբույսերով։',
    price: 3000, station: 'KITCHEN',
    attachments: [{ group: 'doneness' }, { group: 'spice' }, { group: 'side' }],
    recipe: [{ item: 'chicken', baseQty: 350 }, { item: 'onion', baseQty: 50 }],
  },
  {
    slug: 'lamb-khorovats', category: 'grill',
    name: 'Գառան խորоved', nameRu: 'Бараний хоровац', nameEn: 'Lamb khorovats',
    descHy: 'Քաղցր գառան մսի խորоved՝ լեռնային համեմունքներով։',
    price: 4500, station: 'KITCHEN',
    attachments: [{ group: 'doneness' }, { group: 'spice' }, { group: 'side' }],
    recipe: [{ item: 'lamb', baseQty: 300 }, { item: 'onion', baseQty: 50 }],
  },
  {
    slug: 'lyulya-kebab', category: 'grill',
    name: 'Լյուլյա քյաբաբ', nameRu: 'Люля-кебаб', nameEn: 'Lyulya kebab',
    descHy: 'Աղացած մսից պատրաստված խորоved շամփուրի վրա։',
    price: 3200, station: 'KITCHEN',
    attachments: [{ group: 'spice' }, { group: 'side' }],
    recipe: [{ item: 'ground-beef', baseQty: 250 }, { item: 'onion', baseQty: 40 }],
  },
  {
    slug: 'vegetable-khorovats', category: 'grill',
    name: 'Բանջարեղenի խորоved', nameRu: 'Овощной хоровац', nameEn: 'Vegetable khorovats',
    descHy: 'Ածխի վրա խորоved սմբուկ, բիբար և պոմիդոր։',
    price: 2200, station: 'KITCHEN',
    attachments: [{ group: 'spice' }],
    recipe: [{ item: 'eggplant', baseQty: 150 }, { item: 'bell-pepper', baseQty: 100 }, { item: 'tomato', baseQty: 100 }],
  },
  // ── Soups ────────────────────────────────────────────────────────────────────
  {
    slug: 'khash', category: 'soups',
    name: 'Խաշ', nameRu: 'Хаш', nameEn: 'Khash',
    descHy: 'Ավանդական ձմեռային ապուր՝ սխտորով և լավաշով։',
    price: 4000, station: 'KITCHEN',
    attachments: [],
    recipe: [{ item: 'beef', baseQty: 300 }, { item: 'garlic', baseQty: 10 }],
  },
  {
    slug: 'spas', category: 'soups',
    name: 'Սպաս', nameRu: 'Спас', nameEn: 'Spas (yogurt soup)',
    descHy: 'Մածնով ապուր՝ ձավարով և անանուխով։',
    price: 1500, station: 'KITCHEN',
    attachments: [],
    recipe: [{ item: 'matsun', baseQty: 300 }, { item: 'egg', baseQty: 1 }, { item: 'vermicelli', baseQty: 30 }],
  },
  {
    slug: 'kharcho', category: 'soups',
    name: 'Խարճո', nameRu: 'Харчо', nameEn: 'Kharcho',
    descHy: 'Տավարի մսով և բրնձով խիտ կծու ապուր։',
    price: 2000, station: 'KITCHEN',
    attachments: [{ group: 'spice' }],
    recipe: [{ item: 'beef', baseQty: 150 }, { item: 'rice', baseQty: 50 }, { item: 'tomato-paste', baseQty: 30 }],
  },
  {
    slug: 'lentil-soup', category: 'soups',
    name: 'Ոսպapur', nameRu: 'Чечевичный суп', nameEn: 'Lentil soup',
    descHy: 'Կարմիր ոսպով տաք ապուր։',
    price: 1400, station: 'KITCHEN',
    attachments: [],
    recipe: [{ item: 'red-lentils', baseQty: 80 }, { item: 'carrot', baseQty: 40 }, { item: 'onion', baseQty: 30 }],
  },
  // ── Salads ───────────────────────────────────────────────────────────────────
  {
    slug: 'summer-salad', category: 'salads',
    name: 'Ամառային аղցան', nameRu: 'Летний салат', nameEn: 'Summer salad',
    descHy: 'Թարմ պոմիդոր, վարունգ և բիբար՝ ձիթապտղի յուղով։',
    price: 1600, station: 'OTHER',
    attachments: [],
    recipe: [{ item: 'tomato', baseQty: 150 }, { item: 'cucumber', baseQty: 150 }, { item: 'bell-pepper', baseQty: 50 }],
  },
  {
    slug: 'olivier', category: 'salads',
    name: 'Օլիվյե', nameRu: 'Оливье', nameEn: 'Olivier salad',
    descHy: 'Դասական տոնական աղցան՝ հավով և բանջարեղenով։',
    price: 1800, station: 'OTHER',
    attachments: [],
    recipe: [{ item: 'potato', baseQty: 120 }, { item: 'carrot', baseQty: 50 }, { item: 'egg', baseQty: 1 }, { item: 'chicken', baseQty: 80 }],
  },
  {
    slug: 'grilled-eggplant-salad', category: 'salads',
    name: 'Խորоved բանջարեղenի аղցан', nameRu: 'Салат из овощей гриль', nameEn: 'Grilled vegetable salad',
    descHy: 'Խորоved սմբուկ և բիբар՝ սխтором և համемом։',
    price: 2000, station: 'KITCHEN',
    attachments: [{ group: 'spice' }],
    recipe: [{ item: 'eggplant', baseQty: 150 }, { item: 'bell-pepper', baseQty: 100 }, { item: 'tomato', baseQty: 80 }, { item: 'garlic', baseQty: 5 }],
  },
  {
    slug: 'cheese-plate', category: 'salads',
    name: 'Պանրի տեսականի', nameRu: 'Сырная тарелка', nameEn: 'Cheese plate',
    descHy: 'Լոռի, չեչիլ պանիր և ընկույզ։',
    price: 2800, station: 'OTHER',
    attachments: [],
    recipe: [{ item: 'lori-cheese', baseQty: 120 }, { item: 'string-cheese', baseQty: 60 }, { item: 'walnuts', baseQty: 20 }],
  },
  // ── Mains ────────────────────────────────────────────────────────────────────
  {
    slug: 'dolma', category: 'mains',
    name: 'Տոլма', nameRu: 'Толма', nameEn: 'Dolma',
    descHy: 'Խաղողի տերևով փաթաթված աղацած միս ու բրինձ։',
    price: 3000, station: 'KITCHEN',
    attachments: [{ group: 'spice' }],
    recipe: [{ item: 'ground-beef', baseQty: 200 }, { item: 'rice', baseQty: 50 }, { item: 'onion', baseQty: 40 }],
  },
  {
    slug: 'ghapama', category: 'mains',
    name: 'Ղափама', nameRu: 'Гапама', nameEn: 'Ghapama',
    descHy: 'Դդումի մեջ եփваড բринձ՝ չորամрգով և կարагով։',
    price: 3500, station: 'KITCHEN',
    attachments: [],
    recipe: [{ item: 'rice', baseQty: 120 }, { item: 'dried-apricot', baseQty: 40 }, { item: 'raisins', baseQty: 30 }, { item: 'butter', baseQty: 30 }],
  },
  {
    slug: 'harissa', category: 'mains',
    name: 'Հարիսա', nameRu: 'Хариса', nameEn: 'Harissa',
    descHy: 'Հավի մсով և ձаварով խიտ ավանդական ճашатесак։',
    price: 2500, station: 'KITCHEN',
    attachments: [],
    recipe: [{ item: 'chicken', baseQty: 150 }, { item: 'bulgur', baseQty: 100 }, { item: 'butter', baseQty: 20 }],
  },
  {
    slug: 'beef-pot', category: 'mains',
    name: 'Տавари կճուճ', nameRu: 'Говядина в горшочке', nameEn: 'Beef pot stew',
    descHy: 'Կаварում շիկาצрած տавари միс կारтоֆилов։',
    price: 3800, station: 'KITCHEN',
    attachments: [{ group: 'spice' }],
    recipe: [{ item: 'beef', baseQty: 300 }, { item: 'potato', baseQty: 150 }, { item: 'onion', baseQty: 50 }, { item: 'tomato-paste', baseQty: 30 }],
  },
  {
    slug: 'chicken-tabaka', category: 'mains',
    name: 'Հավի տапака', nameRu: 'Цыпленок табака', nameEn: 'Chicken tabaka',
    descHy: 'Սխтором և կարагов տапакваד амбоջ հав։',
    price: 3200, station: 'KITCHEN',
    attachments: [{ group: 'side' }],
    recipe: [{ item: 'chicken', baseQty: 400 }, { item: 'garlic', baseQty: 10 }, { item: 'butter', baseQty: 20 }],
  },
  {
    slug: 'stuffed-peppers', category: 'mains',
    name: 'Լցонад բիբар', nameRu: 'Фаршированный перец', nameEn: 'Stuffed peppers',
    descHy: 'Մсov և բрнձov լцоնад բиբар։',
    price: 2800, station: 'KITCHEN',
    attachments: [{ group: 'spice' }],
    recipe: [{ item: 'bell-pepper', baseQty: 200 }, { item: 'ground-beef', baseQty: 150 }, { item: 'rice', baseQty: 40 }],
  },
  {
    slug: 'fried-potato', category: 'mains',
    name: 'Տапакад կартofил', nameRu: 'Жареный картофель', nameEn: 'Fried potato',
    descHy: 'Ոսկегույն տапакад կартofил խотабուысерov։',
    price: 1500, station: 'KITCHEN',
    attachments: [{ group: 'spice' }],
    recipe: [{ item: 'potato', baseQty: 300 }, { item: 'sunflower-oil', baseQty: 50 }],
  },
  {
    slug: 'lavash', category: 'mains',
    name: 'Լավաշ', nameRu: 'Лаваш', nameEn: 'Lavash',
    descHy: 'Թонрatum թխваড ավандական լավаш։',
    price: 300, station: 'KITCHEN',
    attachments: [],
    recipe: [{ item: 'flour', baseQty: 120 }],
  },
  // ── Drinks (BAR) ──────────────────────────────────────────────────────────────
  {
    slug: 'armenian-coffee', category: 'drinks',
    name: 'Հայկական սурճ', nameRu: 'Армянский кофе', nameEn: 'Armenian coffee',
    descHy: 'Ավազի վրա եփвад անуշабուр սурճ։',
    price: 800, station: 'BAR',
    attachments: [{ group: 'size' }],
    recipe: [{ item: 'coffee-beans', baseQty: 18 }, { item: 'sugar', baseQty: 10 }],
  },
  {
    slug: 'black-tea-cup', category: 'drinks',
    name: 'Սև թеյ', nameRu: 'Чёрный чай', nameEn: 'Black tea',
    descHy: 'Տաք սև թеյ՝ լимоном։',
    price: 600, station: 'BAR',
    attachments: [],
    recipe: [{ item: 'black-tea', baseQty: 5 }, { item: 'sugar', baseQty: 10 }],
  },
  {
    slug: 'cola-glass', category: 'drinks',
    name: 'Կола', nameRu: 'Кола', nameEn: 'Cola',
    descHy: 'Սառցով զովацуцич ըմպելիք։',
    price: 700, station: 'BAR',
    attachments: [{ group: 'size' }],
    recipe: [{ item: 'cola', baseQty: 330 }],
  },
  {
    slug: 'tarragon-lemonade-glass', category: 'drinks',
    name: 'Թархуни лимонад', nameRu: 'Лимонад тархун', nameEn: 'Tarragon lemonade',
    descHy: 'Դасական թархуни համով զովацуцич։',
    price: 900, station: 'BAR',
    attachments: [{ group: 'size' }],
    recipe: [{ item: 'tarragon-lemonade', baseQty: 330 }],
  },
  {
    slug: 'areni-wine-glass', category: 'drinks',
    name: 'Արени գini (բаժак)', nameRu: 'Вино Арени (бокал)', nameEn: 'Areni wine (glass)',
    descHy: 'Արенի сort խաղоgu չор կармир գini։',
    price: 2500, station: 'BAR',
    attachments: [],
    recipe: [{ item: 'areni-red-wine', baseQty: 150 }],
  },
  {
    slug: 'ararat-brandy', category: 'drinks',
    name: 'Արарат կоnyак (50մл)', nameRu: 'Коньяк Арарат (50 мл)', nameEn: 'Ararat brandy (50ml)',
    descHy: 'Հնацрад հаикакан կоnyак։',
    price: 3000, station: 'BAR',
    attachments: [],
    recipe: [{ item: 'ararat-cognac', baseQty: 50 }],
  },
  {
    slug: 'mineral-water-bottle', category: 'drinks',
    name: 'Հаnqайин ջур', nameRu: 'Минеральная вода', nameEn: 'Mineral water',
    descHy: 'Ջермուки бնական հаnqайин ջур։',
    price: 500, station: 'BAR',
    attachments: [],
    recipe: [{ item: 'mineral-water', baseQty: 500 }],
  },
  // ── Desserts ──────────────────────────────────────────────────────────────────
  {
    slug: 'gata', category: 'desserts',
    name: 'Գаթа', nameRu: 'Гата', nameEn: 'Gata',
    descHy: 'Քաղцр խморегеն՝ թейի հамар։',
    price: 1200, station: 'DESSERT',
    attachments: [],
    recipe: [{ item: 'flour', baseQty: 100 }, { item: 'butter', baseQty: 40 }, { item: 'sugar', baseQty: 50 }],
  },
  {
    slug: 'dried-fruit-plate', category: 'desserts',
    name: 'Չорамрги тесакани', nameRu: 'Тарелка сухофруктов', nameEn: 'Dried fruit plate',
    descHy: 'Չир, чамич և ընкуйз։',
    price: 2000, station: 'DESSERT',
    attachments: [],
    recipe: [{ item: 'dried-apricot', baseQty: 60 }, { item: 'raisins', baseQty: 40 }, { item: 'walnuts', baseQty: 40 }],
  },
  // ── CATALOG-3/4 verification fixtures (verify on the FLAGSHIP branch; the
  //    produced-item process graph is seeded there). ─────────────────────────────
  {
    // Deep walk + VERIFIED allergen: marinated-pork-cubes (produced) -> pork-leg
    // (reviewed, no allergen); butter (reviewed, milk). Rollup => {milk}, complete=true.
    slug: 'verify-pork-skewer', category: 'grill',
    name: 'Ստուգում՝ խոզի շիշ', nameRu: 'Проверка: свиной шашлык', nameEn: 'Verify: pork skewer',
    descHy: 'CATALOG ստուգման ուտեստ՝ արտադրված բաղադրիչով (խորը քայլք)։',
    price: 3600, station: 'KITCHEN',
    attachments: [],
    recipe: [{ item: 'marinated-pork-cubes', baseQty: 200 }, { item: 'butter', baseQty: 10 }],
  },
  {
    // UNVERIFIED leaf: walnuts (adopted but NOT reviewed) + butter (reviewed, milk).
    // Rollup => {milk, nuts}, complete=FALSE. Flip walnuts reviewed => complete=TRUE.
    slug: 'verify-walnut-plate', category: 'salads',
    name: 'Ստուգում՝ ընկույզով ափսե', nameRu: 'Проверка: тарелка с орехами', nameEn: 'Verify: walnut plate',
    descHy: 'CATALOG ստուգման ուտեստ՝ չստուգված ալերգենով բաղադրիչ։',
    price: 2400, station: 'OTHER',
    attachments: [],
    recipe: [{ item: 'walnuts', baseQty: 30 }, { item: 'butter', baseQty: 10 }],
  },
  {
    // MODIFIER adds an allergen: base rice (reviewed, no allergen) => complete=true, no
    // allergens; selecting "add walnuts" draws walnuts => order rollup gains nuts AND
    // complete=FALSE (walnuts unreviewed). Exercises the CATALOG-4 per-order-item path.
    slug: 'verify-rice-bowl', category: 'mains',
    name: 'Ստուգում՝ բրնձով ափսե', nameRu: 'Проверка: рисовая тарелка', nameEn: 'Verify: rice bowl',
    descHy: 'CATALOG ստուգման ուտեստ՝ ալերգեն ավելացնող հավելումով։',
    price: 2600, station: 'KITCHEN',
    attachments: [{ group: 'addons' }],
    recipe: [{ item: 'rice', baseQty: 120 }],
    modifierConsumptions: [{ group: 'addons', option: 'add-walnuts', item: 'walnuts', baseQty: 20 }],
  },
];
