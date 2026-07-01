/**
 * CX-1 consumer-discovery seed data.
 *
 * Taxonomy is platform-defined reference data (global, not tenant-scoped). We seed
 * the 10 categories with a STARTER set of values per category; the full curated
 * value set is managed by platform-admin later (CX-ADMIN). i18n is per-column
 * hy/ru/en. Ids are deterministic (uuidv5 from stable slugs) so attribute filters
 * are stable across runs.
 *
 * Screenshot examples are placed under the right categories: `Live shows`
 * (Musical atmosphere), `European` + `Japanese` (Cuisine & Menu).
 */
import { seedId } from '../ids';

export interface AttrValueSeed {
  id: string;
  slug: string;
  labelHy: string;
  labelRu: string;
  labelEn: string;
  position: number;
}

export interface AttrCategorySeed {
  id: string;
  slug: string;
  labelHy: string;
  labelRu: string;
  labelEn: string;
  position: number;
  isFilterable: boolean;
  values: AttrValueSeed[];
}

function value(categorySlug: string, slug: string, hy: string, ru: string, en: string, position: number): AttrValueSeed {
  return { id: seedId(`attrval:${categorySlug}:${slug}`), slug, labelHy: hy, labelRu: ru, labelEn: en, position };
}

function category(
  slug: string,
  hy: string,
  ru: string,
  en: string,
  position: number,
  isFilterable: boolean,
  values: Array<[slug: string, hy: string, ru: string, en: string]>,
): AttrCategorySeed {
  return {
    id: seedId(`attrcat:${slug}`),
    slug,
    labelHy: hy,
    labelRu: ru,
    labelEn: en,
    position,
    isFilterable,
    values: values.map((v, i) => value(slug, v[0], v[1], v[2], v[3], i)),
  };
}

export const ATTRIBUTE_TAXONOMY: AttrCategorySeed[] = [
  category('cuisine-menu', 'Խոհանոց և մենյու', 'Кухня и меню', 'Cuisine & Menu', 0, true, [
    ['armenian', 'Հայկական', 'Армянская', 'Armenian'],
    ['european', 'Եվրոպական', 'Европейская', 'European'],
    ['japanese', 'Ճապոնական', 'Японская', 'Japanese'],
    ['georgian', 'Վրացական', 'Грузинская', 'Georgian'],
  ]),
  category('special-dishes', 'Հատուկ ուտեստներ', 'Особые блюда', 'Special dishes', 1, true, [
    ['bbq', 'Խորոված', 'Барбекю', 'BBQ'],
    ['seafood', 'Ծովամթերք', 'Морепродукты', 'Seafood'],
    ['vegan', 'Վեգան', 'Веган', 'Vegan'],
  ]),
  category('desserts-drinks', 'Աղանդեր և ըմպելիքներ', 'Десерты и напитки', 'Desserts & Drinks', 2, true, [
    ['wine', 'Գինի', 'Вино', 'Wine'],
    ['cocktails', 'Կոկտեյլներ', 'Коктейли', 'Cocktails'],
    ['coffee', 'Սուրճ', 'Кофе', 'Coffee'],
    ['pastry', 'Հրուշակեղեն', 'Выпечка', 'Pastry'],
  ]),
  category('suitable-for', 'Հարմար է', 'Подходит для', 'Suitable for', 3, true, [
    ['families', 'Ընտանիքների', 'Семей', 'Families'],
    ['business', 'Գործնական հանդիպումների', 'Деловых встреч', 'Business'],
    ['romantic', 'Ռոմանտիկ ընթրիքի', 'Романтического ужина', 'Romantic'],
    ['groups', 'Մեծ խմբերի', 'Больших компаний', 'Large groups'],
  ]),
  category('view-location', 'Տեսարան և տեղ', 'Вид и расположение', 'View & Location', 4, true, [
    ['city-view', 'Քաղաքի տեսարան', 'Вид на город', 'City view'],
    ['terrace', 'Բացօթյա պատշգամբ', 'Терраса', 'Terrace'],
    ['garden', 'Այգի', 'Сад', 'Garden'],
  ]),
  category('musical-atmosphere', 'Երաժշտական մթնոլորտ', 'Музыкальная атмосфера', 'Musical atmosphere', 5, true, [
    ['live-shows', 'Կենդանի շոուներ', 'Живые шоу', 'Live shows'],
    ['live-music', 'Կենդանի երաժշտություն', 'Живая музыка', 'Live music'],
    ['dj', 'Դի-ջեյ', 'Диджей', 'DJ'],
  ]),
  category('reservations', 'Ամրագրումներ', 'Бронирование', 'Reservations', 6, true, [
    ['accepts-reservations', 'Ընդունում է ամրագրումներ', 'Принимает бронь', 'Accepts reservations'],
    ['walk-ins', 'Առանց ամրագրման', 'Без брони', 'Walk-ins welcome'],
  ]),
  category('delivery-takeaway', 'Առաքում և տանտար', 'Доставка и навынос', 'Delivery & Takeaway', 7, true, [
    ['delivery', 'Առաքում', 'Доставка', 'Delivery'],
    ['takeaway', 'Տանտար', 'Навынос', 'Takeaway'],
  ]),
  category('guest-comfort', 'Հյուրերի հարմարավետություն', 'Комфорт гостей', 'Guest comfort', 8, true, [
    ['wifi', 'Անվճար Wi-Fi', 'Бесплатный Wi-Fi', 'Free Wi-Fi'],
    ['parking', 'Կայանատեղի', 'Парковка', 'Parking'],
    ['wheelchair', 'Հաշմանդամների մատչելիություն', 'Доступ для инвалидов', 'Wheelchair accessible'],
    ['smoking-area', 'Ծխելու գոտի', 'Зона для курения', 'Smoking area'],
  ]),
  category('children-entertainment', 'Մանկական ժամանց', 'Детские развлечения', "Children's entertainment", 9, true, [
    ['kids-menu', 'Մանկական մենյու', 'Детское меню', 'Kids menu'],
    ['play-area', 'Խաղահրապարակ', 'Игровая зона', 'Play area'],
    ['animator', 'Անիմատոր', 'Аниматор', 'Animator'],
  ]),
];

/** Value slugs the flagship branch selects (a handful across categories). */
export const FLAGSHIP_ATTRIBUTE_SELECTION: Array<[categorySlug: string, valueSlug: string]> = [
  ['cuisine-menu', 'armenian'],
  ['cuisine-menu', 'european'],
  ['special-dishes', 'bbq'],
  ['desserts-drinks', 'wine'],
  ['musical-atmosphere', 'live-shows'],
  ['view-location', 'terrace'],
  ['suitable-for', 'families'],
  ['guest-comfort', 'wifi'],
];

/** Resolve a (category, value) slug pair to its deterministic AttributeValue id. */
export function attributeValueId(categorySlug: string, valueSlug: string): string {
  return seedId(`attrval:${categorySlug}:${valueSlug}`);
}

/** Brand marketing profile for the demo restaurant. */
export const FLAGSHIP_MARKETING = {
  aboutHy:
    'Թավերն Արարատ — ավանդական հայկական խոհանոց Երևանի սրտում, կենդանի երաժշտությամբ և տաք հյուրընկալությամբ։',
  aboutRu:
    'Таверна Арарат — традиционная армянская кухня в сердце Еревана, с живой музыкой и тёплым гостеприимством.',
  aboutEn:
    'Tavern Ararat — traditional Armenian cuisine in the heart of Yerevan, with live music and warm hospitality.',
  website: 'https://tavern-ararat.am',
  logoUrl: 'https://cdn.example.com/tavern-ararat/logo.png',
};

/** Stable https placeholder gallery photos. */
export const FLAGSHIP_PHOTOS: Array<{ url: string; altHy: string; altRu: string; altEn: string }> = [
  {
    url: 'https://cdn.example.com/tavern-ararat/hero.jpg',
    altHy: 'Հիմնական դահլիճ', altRu: 'Главный зал', altEn: 'Main dining hall',
  },
  {
    url: 'https://cdn.example.com/tavern-ararat/terrace.jpg',
    altHy: 'Բացօթյա պատշգամբ', altRu: 'Терраса', altEn: 'Terrace',
  },
  {
    url: 'https://cdn.example.com/tavern-ararat/bbq.jpg',
    altHy: 'Խորոված', altRu: 'Барбекю', altEn: 'BBQ grill',
  },
];

/** Branch public contact + location (the listing unit is the Branch). */
export const FLAGSHIP_CONTACT = {
  publicPhone: '+374 10 567890',
  address: 'Հյուսիսային պողոտա 12, Երևան',
  city: 'Երևան',
};

/**
 * Full weekly public hours. dayOfWeek 0=Mon … 6=Sun. Fri+Sat close at 03:00 —
 * a CROSS-MIDNIGHT slot (closesAt < opensAt) to prove the model. Monday closed.
 */
export const FLAGSHIP_HOURS: Array<{
  dayOfWeek: number;
  isClosed: boolean;
  opensAt?: string;
  closesAt?: string;
}> = [
  { dayOfWeek: 0, isClosed: true },
  { dayOfWeek: 1, isClosed: false, opensAt: '11:00', closesAt: '23:00' },
  { dayOfWeek: 2, isClosed: false, opensAt: '11:00', closesAt: '23:00' },
  { dayOfWeek: 3, isClosed: false, opensAt: '11:00', closesAt: '23:00' },
  { dayOfWeek: 4, isClosed: false, opensAt: '11:00', closesAt: '03:00' }, // crosses midnight
  { dayOfWeek: 5, isClosed: false, opensAt: '11:00', closesAt: '03:00' }, // crosses midnight
  { dayOfWeek: 6, isClosed: false, opensAt: '12:00', closesAt: '22:00' },
];
