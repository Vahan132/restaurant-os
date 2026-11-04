/**
 * CATALOG-4 — Kitchen ingredient catalog (hy / ru / en).
 *
 * Platform reference data: every FOOD ingredient a restaurant kitchen may stock
 * (no drinks). Intentionally broad — curation in Platform Admin archives what is
 * not used. Loaded by `pnpm db:seed:platform` (create-missing by slug; `--sync`
 * overwrites names/categories) and by the full seed (phase 14).
 *
 * Row format inside each category block:   slug | Հայերեն | Русский | English
 * Units: CATEGORY_UNIT gives each category's default, UNIT_OVERRIDES the exceptions.
 * Slugs are permanent identifiers (tenant InventoryItems reference catalog items),
 * so never rename a slug — fix the names instead.
 */

export interface KitchenCategory {
  slug: string;
  labelHy: string;
  labelRu: string;
  labelEn: string;
}

/** Stocking unit — same values as InventoryBaseUnit / CatalogUnit. */
export type KitchenUnit = 'GRAM' | 'MILLILITER' | 'PIECE';

export interface KitchenItem {
  slug: string;
  nameHy: string;
  nameRu: string;
  nameEn: string;
  categorySlug: string;
  baseUnit: KitchenUnit;
}

/** CATALOG-UNIT-1: default unit per category (anything not listed = GRAM). */
const CATEGORY_UNIT: Record<string, KitchenUnit> = {
  eggs: 'PIECE',
  bakery: 'PIECE',
};

/** Per-item exceptions to the category default: liquids in ml, counted items in pieces. */
const UNIT_OVERRIDES: Record<string, KitchenUnit> = {
  // liquids
  milk: 'MILLILITER',
  'cooking-cream': 'MILLILITER',
  'whipping-cream': 'MILLILITER',
  'cream-10': 'MILLILITER',
  'vegetable-cream': 'MILLILITER',
  kefir: 'MILLILITER',
  'sunflower-oil': 'MILLILITER',
  'olive-oil-extra-virgin': 'MILLILITER',
  'olive-oil-refined': 'MILLILITER',
  'corn-oil': 'MILLILITER',
  'rapeseed-oil': 'MILLILITER',
  'sesame-oil': 'MILLILITER',
  'frying-oil': 'MILLILITER',
  'truffle-oil': 'MILLILITER',
  'walnut-oil': 'MILLILITER',
  'soy-sauce': 'MILLILITER',
  'teriyaki-sauce': 'MILLILITER',
  'worcestershire-sauce': 'MILLILITER',
  tabasco: 'MILLILITER',
  'balsamic-vinegar': 'MILLILITER',
  'red-wine-vinegar': 'MILLILITER',
  'white-wine-vinegar': 'MILLILITER',
  'apple-cider-vinegar': 'MILLILITER',
  'table-vinegar': 'MILLILITER',
  'lemon-juice': 'MILLILITER',
  'chicken-stock': 'MILLILITER',
  'beef-stock': 'MILLILITER',
  'vegetable-stock': 'MILLILITER',
  'glucose-syrup': 'MILLILITER',
  'maple-syrup': 'MILLILITER',
  'caramel-sauce': 'MILLILITER',
  'chocolate-topping': 'MILLILITER',
  'rose-water': 'MILLILITER',
  'vanilla-extract': 'MILLILITER',
  'food-coloring': 'MILLILITER',
  'rice-vinegar': 'MILLILITER',
  mirin: 'MILLILITER',
  'fish-sauce': 'MILLILITER',
  'coconut-milk': 'MILLILITER',
  'sesame-dressing': 'MILLILITER',
  // counted
  'corn-cob': 'PIECE',
  artichoke: 'PIECE',
  avocado: 'PIECE',
  coconut: 'PIECE',
  quail: 'PIECE',
  oysters: 'PIECE',
  'vanilla-pod': 'PIECE',
  'bouillon-cubes': 'PIECE',
  nori: 'PIECE',
  'spring-roll-wrappers': 'PIECE',
  'rice-paper': 'PIECE',
  'gyoza-wrappers': 'PIECE',
  'burger-patties': 'PIECE',
  // bakery items sold/stocked by weight
  'puff-pastry': 'GRAM',
  'yeast-dough': 'GRAM',
  'phyllo-dough': 'GRAM',
  kataifi: 'GRAM',
};

interface Block {
  category: KitchenCategory;
  rows: string;
}

const block = (
  slug: string,
  labelHy: string,
  labelRu: string,
  labelEn: string,
  rows: string,
): Block => ({ category: { slug, labelHy, labelRu, labelEn }, rows });

const BLOCKS: Block[] = [
  block('vegetables', 'Բանջարեղեն', 'Овощи', 'Vegetables', `
potato | Կարտոֆիլ | Картофель | Potato
young-potato | Մատղաշ կարտոֆիլ | Молодой картофель | New potatoes
sweet-potato | Բատատ | Батат | Sweet potato
onion | Սոխ | Лук репчатый | Onion
red-onion | Կարմիր սոխ | Лук красный | Red onion
white-onion | Սպիտակ սոխ | Лук белый | White onion
shallot | Շալոտ սոխ | Лук-шалот | Shallot
leek | Պրաս | Лук-порей | Leek
garlic | Սխտոր | Чеснок | Garlic
young-garlic | Մատղաշ սխտոր | Молодой чеснок | Young garlic
carrot | Գազար | Морковь | Carrot
baby-carrot | Մանր գազար | Морковь мини | Baby carrots
beetroot | Ճակնդեղ | Свёкла | Beetroot
radish | Բողկ | Редис | Radish
black-radish | Սև բողկ | Редька чёрная | Black radish
daikon | Դայկոն | Дайкон | Daikon
turnip | Շաղգամ | Репа | Turnip
rutabaga | Բրյուկվա | Брюква | Rutabaga
parsnip | Պաստինակ | Пастернак | Parsnip
celery-root | Նեխուրի արմատ | Сельдерей корневой | Celery root
celery-stalk | Նեխուրի ցողուն | Сельдерей стеблевой | Celery stalks
parsley-root | Մաղադանոսի արմատ | Корень петрушки | Parsley root
horseradish-root | Ծովաբողկի արմատ | Хрен (корень) | Horseradish root
ginger-root | Կոճապղպեղ | Имбирь (корень) | Ginger root
jerusalem-artichoke | Գետնախնձոր | Топинамбур | Jerusalem artichoke
white-cabbage | Կաղամբ | Капуста белокочанная | White cabbage
young-cabbage | Մատղաշ կաղամբ | Капуста молодая | Young cabbage
red-cabbage | Կարմիր կաղամբ | Капуста краснокочанная | Red cabbage
savoy-cabbage | Սավոյան կաղամբ | Капуста савойская | Savoy cabbage
napa-cabbage | Պեկինյան կաղամբ | Капуста пекинская | Napa cabbage
bok-choy | Բոկ չոյ | Бок-чой | Bok choy
cauliflower | Ծաղկակաղամբ | Капуста цветная | Cauliflower
broccoli | Բրոկկոլի | Брокколи | Broccoli
broccolini | Բրոկկոլինի | Брокколини | Broccolini
brussels-sprouts | Բրյուսելյան կաղամբ | Капуста брюссельская | Brussels sprouts
kohlrabi | Կոլրաբի | Кольраби | Kohlrabi
kale | Կալե կաղամբ | Капуста кале | Kale
romanesco | Ռոմանեսկո | Романеско | Romanesco
tomato | Լոլիկ | Помидоры | Tomatoes
pink-tomato | Վարդագույն լոլիկ | Помидоры розовые | Pink tomatoes
cherry-tomato | Չերի լոլիկ | Помидоры черри | Cherry tomatoes
cherry-tomato-vine | Չերի լոլիկ ճյուղով | Помидоры черри на ветке | Vine cherry tomatoes
plum-tomato | Սալորաձև լոլիկ | Помидоры сливка | Plum tomatoes
yellow-tomato | Դեղին լոլիկ | Помидоры жёлтые | Yellow tomatoes
green-tomato | Կանաչ լոլիկ | Помидоры зелёные | Green tomatoes
cucumber | Վարունգ | Огурцы | Cucumbers
long-cucumber | Երկար վարունգ | Огурцы длинноплодные | Long (English) cucumbers
gherkin-fresh | Թարմ կորնիշոն | Корнишоны свежие | Fresh gherkins
bell-pepper-red | Կարմիր բուլղարական պղպեղ | Перец болгарский красный | Red bell pepper
bell-pepper-yellow | Դեղին բուլղարական պղպեղ | Перец болгарский жёлтый | Yellow bell pepper
bell-pepper-green | Կանաչ բուլղարական պղպեղ | Перец болгарский зелёный | Green bell pepper
sweet-pepper-long | Երկար քաղցր պղպեղ | Перец сладкий длинный | Long sweet pepper
sweet-pepper-mini | Մինի քաղցր պղպեղ | Перец сладкий мини | Mini sweet peppers
chili-green | Կանաչ կծու պղպեղ | Перец острый зелёный | Green chili
chili-red | Կարմիր կծու պղպեղ | Перец острый красный | Red chili
jalapeno | Խալապենյո | Халапеньо | Jalapeño
habanero | Հաբանյերո | Хабанеро | Habanero
eggplant | Սմբուկ | Баклажаны | Eggplant
zucchini | Դդմիկ | Кабачки | Zucchini
yellow-zucchini | Դեղին դդմիկ | Кабачки жёлтые | Yellow zucchini
pattypan-squash | Պատիսոն | Патиссоны | Pattypan squash
pumpkin | Դդում | Тыква | Pumpkin
butternut-squash | Մուսկատային դդում | Тыква мускатная | Butternut squash
corn-cob | Եգիպտացորենի կոճ | Кукуруза в початках | Corn on the cob
baby-corn | Մինի եգիպտացորեն | Кукуруза мини | Baby corn
green-peas-fresh | Թարմ կանաչ ոլոռ | Горошек зелёный свежий | Fresh green peas
green-beans | Կանաչ լոբի | Фасоль стручковая | Green beans
snow-peas | Շաքարային ոլոռի պատիճ | Горох сахарный (стручки) | Snow peas
edamame | Էդամամե | Эдамаме | Edamame
asparagus-green | Կանաչ ծնեբեկ | Спаржа зелёная | Green asparagus
asparagus-white | Սպիտակ ծնեբեկ | Спаржа белая | White asparagus
artichoke | Արտիճուկ | Артишоки | Artichokes
fennel-bulb | Ռազիանա (ֆենխել) | Фенхель | Fennel bulb
okra | Բամիա | Бамия | Okra
rhubarb | Խավարծիլ | Ревень | Rhubarb
bean-sprouts | Սոյայի ծիլեր | Ростки сои | Bean sprouts
olive-fresh | Թարմ ձիթապտուղ | Оливки свежие | Fresh olives
lotus-root | Լոտոսի արմատ | Корень лотоса | Lotus root
taro | Տարո | Таро | Taro
cassava | Կասավա (մանիոկ) | Маниок (кассава) | Cassava
chayote | Չայոտ | Чайот | Chayote
`),

  block('greens-herbs', 'Կանաչեղեն և թարմ խոտաբույսեր', 'Зелень и свежие травы', 'Greens & fresh herbs', `
parsley | Մաղադանոս | Петрушка | Parsley
curly-parsley | Գանգուր մաղադանոս | Петрушка кудрявая | Curly parsley
dill | Սամիթ | Укроп | Dill
cilantro | Համեմ | Кинза | Cilantro
basil-green | Կանաչ ռեհան | Базилик зелёный | Green basil
basil-purple | Մանուշակագույն ռեհան | Базилик фиолетовый | Purple basil
mint | Անանուխ | Мята | Mint
tarragon | Թարխուն | Тархун (эстрагон) | Tarragon
green-onion | Կանաչ սոխ | Лук зелёный | Green onions
chives | Շնիտ սոխ | Шнитт-лук | Chives
wild-garlic | Վայրի սխտոր (կանչ) | Черемша | Wild garlic (ramsons)
rosemary-fresh | Թարմ ռոզմարին | Розмарин свежий | Fresh rosemary
thyme-fresh | Թարմ ուրց | Тимьян свежий | Fresh thyme
oregano-fresh | Թարմ օրեգանո | Орегано свежий | Fresh oregano
sage-fresh | Թարմ եղեսպակ | Шалфей свежий | Fresh sage
marjoram-fresh | Թարմ մայորան | Майоран свежий | Fresh marjoram
lemon-balm | Մելիսա | Мелисса | Lemon balm
lovage | Լյուբիստոկ | Любисток | Lovage
chervil | Կերվել | Кервель | Chervil
lemongrass | Լեմոնգրաս | Лемонграсс | Lemongrass
celery-leaves | Նեխուրի տերևներ | Сельдерей листовой | Celery leaves
spinach | Սպանախ | Шпинат | Spinach
baby-spinach | Մատղաշ սպանախ | Шпинат бейби | Baby spinach
sorrel | Թրթնջուկ | Щавель | Sorrel
swiss-chard | Մանգոլդ | Мангольд | Swiss chard
arugula | Ռուկոլա | Руккола | Arugula
iceberg-lettuce | Այսբերգ աղցան | Салат айсберг | Iceberg lettuce
romaine-lettuce | Ռոմեն աղցան | Салат романо | Romaine lettuce
leaf-lettuce | Տերևավոր աղցան | Салат листовой | Leaf lettuce
butter-lettuce | Բատավիա աղցան | Салат батавия | Batavia lettuce
lollo-rosso | Լոլո ռոսսո | Лолло россо | Lollo rosso
oakleaf-lettuce | Կաղնու տերև աղցան | Салат дуболистный | Oak leaf lettuce
frisee | Ֆրիզե | Фризе | Frisée
radicchio | Ռադիկիո | Радиккио | Radicchio
endive | Էնդիվ | Эндивий | Endive
lambs-lettuce | Կորն աղցան | Салат корн (валерианелла) | Lamb's lettuce
watercress | Ջրկոտեմ | Кресс-салат | Watercress
salad-mix | Աղցանի տերևների խառնուրդ | Салатный микс | Mixed salad leaves
microgreens | Միկրոկանաչի | Микрозелень | Microgreens
pea-shoots | Ոլոռի ծիլեր | Побеги гороха | Pea shoots
purslane | Դանդուռ | Портулак | Purslane
nettle | Եղինջ | Крапива | Nettle
mallow | Փիփերթ | Мальва (просвирник) | Mallow
mandak | Մանդակ | Мандак | Mandak (wild chervil)
aveluk | Ավելուկ | Авелук (конский щавель) | Aveluk (dried sorrel braids)
sibekh | Սիբեխ | Сибех | Sibekh (wild greens)
shushan | Շուշանի կանաչի | Шушан | Shushan (wild greens)
grape-leaves | Թարմ խաղողի տերև | Виноградные листья свежие | Fresh grape leaves
cabbage-leaves | Կաղամբի տերև (տոլմայի) | Капустные листья для долмы | Cabbage leaves (for tolma)
edible-flowers | Ուտելի ծաղիկներ | Съедобные цветы | Edible flowers
`),

  block('mushrooms', 'Սնկեր', 'Грибы', 'Mushrooms', `
champignon | Շամպինյոն | Шампиньоны | Button mushrooms
brown-champignon | Թագավորական շամպինյոն | Шампиньоны королевские | Cremini mushrooms
portobello | Պորտոբելլո | Портобелло | Portobello
oyster-mushroom | Ոստրեսունկ (վեշենկա) | Вешенки | Oyster mushrooms
king-oyster-mushroom | Թագավորական ոստրեսունկ | Вешенка королевская (эринги) | King oyster mushrooms
shiitake | Շիտակե | Шиитаке | Shiitake
enoki | Էնոկի | Эноки | Enoki
porcini | Սպիտակ սունկ | Белые грибы | Porcini
porcini-dried | Չորացրած սպիտակ սունկ | Белые грибы сушёные | Dried porcini
chanterelle | Աղվեսասունկ | Лисички | Chanterelles
honey-fungus | Մեղրասունկ | Опята | Honey mushrooms
morel | Մորխ | Сморчки | Morels
wood-ear | Չինական սև սունկ (մուեր) | Древесные грибы (муэр) | Wood ear mushrooms
shiitake-dried | Չորացրած շիտակե | Шиитаке сушёные | Dried shiitake
black-truffle | Սև տրյուֆել | Трюфель чёрный | Black truffle
wild-mushroom-mix | Անտառային սնկերի խառնուրդ | Лесные грибы ассорти | Wild mushroom mix
`),

  block('fruits', 'Մրգեր', 'Фрукты', 'Fruits', `
apple-red | Կարմիր խնձոր | Яблоки красные | Red apples
apple-green | Կանաչ խնձոր | Яблоки зелёные | Green apples
apple-yellow | Դեղին խնձոր | Яблоки жёлтые | Yellow apples
pear | Տանձ | Груши | Pears
quince | Սերկևիլ | Айва | Quince
apricot | Ծիրան | Абрикосы | Apricots
peach | Դեղձ | Персики | Peaches
flat-peach | Թզաձև դեղձ | Персики инжирные | Flat peaches
nectarine | Նեկտարին | Нектарины | Nectarines
plum | Սալոր | Сливы | Plums
cherry-plum | Շլոր | Алыча | Cherry plums
sweet-cherry | Կեռաս | Черешня | Sweet cherries
sour-cherry | Բալ | Вишня | Sour cherries
grapes-white | Սպիտակ խաղող | Виноград белый | White grapes
grapes-red | Կարմիր խաղող | Виноград красный | Red grapes
grapes-black | Սև խաղող | Виноград чёрный | Black grapes
pomegranate | Նուռ | Гранат | Pomegranate
fig | Թուզ | Инжир | Figs
persimmon | Խուրմա | Хурма | Persimmon
medlar | Զկեռ | Мушмула | Medlar
watermelon | Ձմերուկ | Арбуз | Watermelon
melon | Սեխ | Дыня | Melon
lemon | Կիտրոն | Лимоны | Lemons
lime | Լայմ | Лаймы | Limes
orange | Նարինջ | Апельсины | Oranges
blood-orange | Կարմիր նարինջ | Апельсины красные (королёк) | Blood oranges
mandarin | Մանդարին | Мандарины | Mandarins
grapefruit | Գրեյպֆրուտ | Грейпфрут | Grapefruit
pomelo | Պոմելո | Помело | Pomelo
kumquat | Կումկվատ | Кумкват | Kumquat
banana | Բանան | Бананы | Bananas
pineapple | Արքայախնձոր | Ананас | Pineapple
mango | Մանգո | Манго | Mango
papaya | Պապայա | Папайя | Papaya
kiwi | Կիվի | Киви | Kiwi
avocado | Ավոկադո | Авокадо | Avocado
coconut | Կոկոս | Кокос | Coconut
passion-fruit | Մարակույա | Маракуйя | Passion fruit
dragon-fruit | Պիտայա | Питахайя | Dragon fruit
lychee | Լիչի | Личи | Lychee
feijoa | Ֆեյխոա | Фейхоа | Feijoa
physalis | Ֆիզալիս | Физалис | Physalis
guava | Գուավա | Гуава | Guava
carambola | Կարամբոլա | Карамбола | Star fruit
`),

  block('berries', 'Հատապտուղներ', 'Ягоды', 'Berries', `
strawberry | Ելակ | Клубника | Strawberries
wild-strawberry | Մորի | Земляника | Wild strawberries
raspberry | Ազնվամորի | Малина | Raspberries
blackberry | Մոշ | Ежевика | Blackberries
blueberry | Հապալաս | Голубика | Blueberries
bilberry | Սև հապալաս | Черника | Bilberries
blackcurrant | Սև հաղարջ | Смородина чёрная | Blackcurrants
redcurrant | Կարմիր հաղարջ | Смородина красная | Redcurrants
gooseberry | Կոկռոշ | Крыжовник | Gooseberries
cranberry | Լոռամիրգ | Клюква | Cranberries
lingonberry | Կովամրգի | Брусника | Lingonberries
sea-buckthorn | Չիչխան | Облепиха | Sea buckthorn
cornelian-cherry | Հոն | Кизил | Cornelian cherries
mulberry-white | Սպիտակ թութ | Шелковица белая | White mulberries
mulberry-black | Սև թութ | Шелковица чёрная | Black mulberries
rosehip | Մասուր | Шиповник | Rosehips
aronia | Արոնիա | Черноплодная рябина | Aronia berries
elderberry | Կտտկենու պտուղ | Бузина | Elderberries
`),

  block('dried-fruits', 'Չրեր', 'Сухофрукты', 'Dried fruits', `
raisins-dark | Մուգ չամիչ | Изюм тёмный | Dark raisins
raisins-golden | Բաց չամիչ | Изюм светлый | Golden raisins
dried-apricots | Ծիրանի չիր (կուրագա) | Курага | Dried apricots
dried-apricots-whole | Ծիրանաչիր կորիզով | Урюк | Whole dried apricots
prunes | Սալորաչիր | Чернослив | Prunes
dates | Արմավ | Финики | Dates
dried-figs | Թզաչիր | Инжир сушёный | Dried figs
dried-cranberries | Չորացրած լոռամիրգ | Клюква вяленая | Dried cranberries
dried-sour-cherries | Չորացրած բալ | Вишня вяленая | Dried sour cherries
dried-apples | Խնձորաչիր | Яблоки сушёные | Dried apples
dried-pears | Տանձաչիր | Груши сушёные | Dried pears
dried-peaches | Դեղձաչիր | Персики сушёные | Dried peaches
dried-mango | Չորացրած մանգո | Манго сушёное | Dried mango
dried-cornel | Հոնաչիր | Кизил сушёный | Dried cornelian cherries
goji-berries | Գոջի հատապտուղ | Ягоды годжи | Goji berries
sujukh-walnut | Սուջուխ (ընկույզով) | Суджух (чурчхела) | Sujukh (walnut churchkhela)
pastegh | Պաստեղ | Пастила (пастех) | Pastegh (fruit leather)
alani | Ալանի | Алани (персики с орехами) | Alani (nut-stuffed dried peaches)
`),

  block('nuts-seeds', 'Ընկուզեղեն և սերմեր', 'Орехи и семена', 'Nuts & seeds', `
walnuts | Ընկույզ | Грецкие орехи | Walnuts
hazelnuts | Պնդուկ | Фундук | Hazelnuts
almonds | Նուշ | Миндаль | Almonds
almond-flakes | Նշի թերթիկներ | Миндальные лепестки | Almond flakes
pistachios | Պիստակ | Фисташки | Pistachios
pistachios-shelled | Կլպած պիստակ | Фисташки очищенные | Shelled pistachios
cashews | Կեշյու | Кешью | Cashews
peanuts | Գետնանուշ | Арахис | Peanuts
pine-nuts | Մայրու ընկույզ | Кедровые орехи | Pine nuts
pecans | Պեկան | Пекан | Pecans
macadamia | Մակադամիա | Макадамия | Macadamia nuts
brazil-nuts | Բրազիլական ընկույզ | Бразильский орех | Brazil nuts
chestnuts | Շագանակ | Каштаны | Chestnuts
coconut-flakes | Կոկոսի փաթիլներ | Кокосовая стружка | Desiccated coconut
sunflower-seeds | Արևածաղկի սերմեր | Семечки подсолнечника | Sunflower seeds
pumpkin-seeds | Դդմի սերմեր | Тыквенные семечки | Pumpkin seeds
sesame-white | Սպիտակ քունջութ | Кунжут белый | White sesame
sesame-black | Սև քունջութ | Кунжут чёрный | Black sesame
flax-seeds | Կտավատի սերմեր | Семена льна | Flax seeds
chia-seeds | Չիայի սերմեր | Семена чиа | Chia seeds
poppy-seeds | Խաշխաշ | Мак | Poppy seeds
hemp-seeds | Կանեփի սերմեր | Семена конопли | Hemp seeds
`),

  block('beef-veal', 'Տավարի և հորթի միս', 'Говядина и телятина', 'Beef & veal', `
beef-tenderloin | Տավարի սուկի | Говяжья вырезка | Beef tenderloin
beef-striploin | Տավարի ստրիպլոյն | Стриплойн говяжий | Beef striploin
beef-ribeye | Տավարի ռիբայ | Рибай говяжий | Beef ribeye
beef-tbone | Տավարի T-բոն | Стейк ти-бон | T-bone steak
beef-picanha | Պիկանյա | Пиканья | Picanha
beef-rump | Տավարի ազդրամիս | Говядина огузок | Beef rump
beef-round | Տավարի բուդ | Говядина задняя часть | Beef round
beef-brisket | Տավարի կրծքամիս | Грудинка говяжья | Beef brisket
beef-chuck | Տավարի թիակ | Лопатка говяжья | Beef chuck (shoulder)
beef-neck | Տավարի պարանոց | Шея говяжья | Beef neck
beef-shank | Տավարի սրունք | Голяшка говяжья | Beef shank
beef-short-ribs | Տավարի կողիկներ | Рёбра говяжьи | Beef short ribs
beef-flank | Տավարի կողամիս | Пашина говяжья | Beef flank
beef-cheeks | Տավարի այտեր | Щёки говяжьи | Beef cheeks
beef-stew-meat | Տավարի միս (տապակելու) | Говядина для тушения | Beef stew meat
beef-mince | Տավարի աղացած միս | Фарш говяжий | Ground beef
beef-bones | Տավարի ոսկորներ | Кости говяжьи | Beef bones
marrow-bones | Ծուծով ոսկորներ | Кости мозговые | Marrow bones
oxtail | Տավարի պոչ | Бычий хвост | Oxtail
veal-tenderloin | Հորթի սուկի | Вырезка телячья | Veal tenderloin
veal-leg | Հորթի բուդ | Телятина задняя часть | Veal leg
veal-shoulder | Հորթի թիակ | Лопатка телячья | Veal shoulder
veal-rack | Հորթի կողիկներ | Корейка телячья | Veal rack
veal-shank | Հորթի սրունք (օսոբուկո) | Голяшка телячья (оссобуко) | Veal shank (osso buco)
veal-mince | Հորթի աղացած միս | Фарш телячий | Ground veal
mixed-mince | Խառը աղացած միս | Фарш смешанный | Mixed ground meat
`),

  block('pork', 'Խոզի միս', 'Свинина', 'Pork', `
pork-tenderloin | Խոզի սուկի | Свиная вырезка | Pork tenderloin
pork-loin | Խոզի կարե | Свиная корейка | Pork loin
pork-neck | Խոզի պարանոց | Свиная шея | Pork neck
pork-shoulder | Խոզի թիակ | Свиная лопатка | Pork shoulder
pork-leg | Խոզի բուդ | Свиная нога | Pork leg
pork-ribs | Խոզի կողիկներ | Свиные рёбра | Pork ribs
pork-belly | Խոզի փորամիս | Свиная грудинка | Pork belly
pork-chop | Խոզի կոտլետ ոսկորով | Свиная котлета на кости | Pork chop
pork-knuckle | Խոզի ծնկամիս (ռուլկա) | Свиная рулька | Pork knuckle
pork-mince | Խոզի աղացած միս | Фарш свиной | Ground pork
pork-fatback | Խոզի ճարպ (սալո) | Сало свиное | Pork fatback
pork-trotters | Խոզի ոտիկներ | Свиные ножки | Pork trotters
pork-ears | Խոզի ականջներ | Свиные уши | Pork ears
pork-bones | Խոզի ոսկորներ | Кости свиные | Pork bones
suckling-pig | Խոճկոր | Молочный поросёнок | Suckling pig
`),

  block('lamb-goat', 'Ոչխարի և այծի միս', 'Баранина и козлятина', 'Lamb & goat', `
lamb-leg | Գառան բուդ | Баранья нога | Lamb leg
lamb-rack | Գառան կարե | Каре ягнёнка | Lamb rack
lamb-shoulder | Գառան թիակ | Баранья лопатка | Lamb shoulder
lamb-loin | Գառան մեջքամիս | Баранья корейка | Lamb loin
lamb-neck | Գառան պարանոց | Баранья шея | Lamb neck
lamb-shank | Գառան սրունք | Баранья голяшка | Lamb shank
lamb-ribs | Ոչխարի կողիկներ | Бараньи рёбра | Lamb ribs
lamb-mince | Ոչխարի աղացած միս | Фарш бараний | Ground lamb
mutton | Ոչխարի միս | Баранина | Mutton
lamb-tail-fat | Դմակ | Курдюк | Lamb tail fat
goat-meat | Այծի միս | Козлятина | Goat meat
`),

  block('poultry', 'Թռչնամիս', 'Птица', 'Poultry', `
whole-chicken | Հավ (ամբողջական) | Курица целая | Whole chicken
spring-chicken | Ճուտ | Цыплёнок | Spring chicken (poussin)
chicken-breast | Հավի կրծքամիս (ֆիլե) | Куриное филе | Chicken breast fillet
chicken-breast-bone | Հավի կրծքամիս ոսկորով | Куриная грудка на кости | Chicken breast on the bone
chicken-thigh | Հավի ազդր | Куриное бедро | Chicken thighs
chicken-thigh-fillet | Հավի ազդրի ֆիլե | Филе куриного бедра | Boneless chicken thighs
chicken-drumstick | Հավի սրունք | Куриная голень | Chicken drumsticks
chicken-leg-quarter | Հավի բուդ | Куриный окорочок | Chicken leg quarters
chicken-wings | Հավի թևիկներ | Куриные крылья | Chicken wings
chicken-mince | Հավի աղացած միս | Фарш куриный | Ground chicken
chicken-carcass | Հավի կմախք (արգանակի) | Куриный каркас | Chicken carcass (for stock)
rooster | Աքաղաղ | Петух | Rooster
quail | Լոր | Перепёлка | Quail
turkey-whole | Հնդկահավ (ամբողջական) | Индейка целая | Whole turkey
turkey-breast | Հնդկահավի կրծքամիս | Филе индейки | Turkey breast
turkey-thigh | Հնդկահավի ազդր | Бедро индейки | Turkey thigh
turkey-mince | Հնդկահավի աղացած միս | Фарш индейки | Ground turkey
duck-whole | Բադ (ամբողջական) | Утка целая | Whole duck
duck-breast | Բադի կրծքամիս | Утиная грудка | Duck breast
duck-leg | Բադի բուդ | Утиная нога | Duck leg
goose | Սագ | Гусь | Goose
guinea-fowl | Մարգարտահավ (ցեսարկա) | Цесарка | Guinea fowl
`),

  block('game', 'Որսամիս և այլ միս', 'Дичь и другое мясо', 'Game & other meat', `
rabbit | Ճագար | Кролик | Rabbit
venison | Եղնիկի միս | Оленина | Venison
wild-boar | Վարազի միս | Кабанятина | Wild boar
pheasant | Փասիան | Фазан | Pheasant
partridge | Կաքավ | Куропатка | Partridge
horse-meat | Ձիու միս | Конина | Horse meat
frog-legs | Գորտի ոտիկներ | Лягушачьи лапки | Frog legs
`),

  block('offal', 'Ենթամթերք', 'Субпродукты', 'Offal', `
beef-liver | Տավարի լյարդ | Печень говяжья | Beef liver
veal-liver | Հորթի լյարդ | Печень телячья | Veal liver
chicken-liver | Հավի լյարդ | Печень куриная | Chicken liver
lamb-liver | Ոչխարի լյարդ | Печень баранья | Lamb liver
beef-tongue | Տավարի լեզու | Язык говяжий | Beef tongue
pork-tongue | Խոզի լեզու | Язык свиной | Pork tongue
beef-heart | Տավարի սիրտ | Сердце говяжье | Beef heart
chicken-hearts | Հավի սրտիկներ | Сердечки куриные | Chicken hearts
chicken-gizzards | Հավի քարաճիկներ | Желудки куриные | Chicken gizzards
chicken-feet | Հավի թաթիկներ | Куриные лапки | Chicken feet
beef-kidneys | Տավարի երիկամներ | Почки говяжьи | Beef kidneys
lamb-kidneys | Ոչխարի երիկամներ | Почки бараньи | Lamb kidneys
beef-tripe | Տավարի փորոտիք | Рубец говяжий | Beef tripe
beef-feet | Տավարի ոտքեր (խաշի) | Говяжьи ноги (для хаша) | Beef feet (for khash)
brains | Ուղեղ | Мозги | Brains
lamb-pluck | Ոչխարի թոքսիրտ | Ливер бараний | Lamb pluck
foie-gras | Ֆուա գրա | Фуа-гра | Foie gras
natural-casings | Բնական աղիքներ (երշիկի) | Натуральная оболочка (кишки) | Natural sausage casings
`),

  block('deli', 'Երշիկեղեն և ապխտած միս', 'Колбасы и мясные деликатесы', 'Sausages & cured meats', `
basturma | Բաստուրմա | Бастурма | Basturma
sujuk-sausage | Սուջուխ (երշիկ) | Суджук (колбаса) | Sujuk (dry sausage)
ham | Խոզապուխտ | Ветчина | Ham
prosciutto | Պրոշուտո | Прошутто | Prosciutto
jamon | Խամոն | Хамон | Jamón
salami | Սալյամի | Салями | Salami
pepperoni | Պեպերոնի | Пепперони | Pepperoni
chorizo | Չորիսո | Чоризо | Chorizo
mortadella | Մորտադելլա | Мортаделла | Mortadella
bacon | Բեկոն | Бекон | Bacon
pancetta | Պանչետա | Панчетта | Pancetta
boiled-sausage | Եփած երշիկ | Колбаса варёная | Boiled sausage
smoked-sausage | Ապխտած երշիկ | Колбаса копчёная | Smoked sausage
frankfurters | Նրբերշիկ | Сосиски | Frankfurters
sardelki | Սարդելկա | Сардельки | Thick frankfurters (sardelki)
grill-sausages | Խորովածի երշիկներ | Колбаски для гриля | Grilling sausages
hunter-sausages | Որսորդական երշիկներ | Охотничьи колбаски | Hunter's sausages
smoked-chicken | Ապխտած հավ | Курица копчёная | Smoked chicken
smoked-ribs | Ապխտած խոզի կողիկներ | Рёбрышки копчёные | Smoked pork ribs
smoked-pork-loin | Ապխտած կարե | Корейка копчёная | Smoked pork loin
liver-pate | Լյարդի պաշտետ | Паштет печёночный | Liver pâté
`),

  block('fish', 'Ձուկ և խավիար', 'Рыба и икра', 'Fish & caviar', `
salmon | Սաղմոն | Лосось | Salmon
salmon-fillet | Սաղմոնի ֆիլե | Филе лосося | Salmon fillet
trout | Կարմրախայտ | Форель | Trout
trout-fillet | Կարմրախայտի ֆիլե | Филе форели | Trout fillet
ishkhan | Իշխան | Ишхан (севанская форель) | Ishkhan (Sevan trout)
sig | Սիգ | Сиг | Whitefish (sig)
khramulya | Կողակ | Храмуля | Khramulya (Caucasian scraper)
carp | Ծածան | Карп | Carp
silver-carp | Հաստաճակատ | Толстолобик | Silver carp
catfish | Լոքո | Сом | Catfish
pike-perch | Սուդակ | Судак | Pike-perch (zander)
pike | Գայլաձուկ | Щука | Pike
sturgeon | Թառափ | Осётр | Sturgeon
sea-bass | Լավրակ (սիբաս) | Сибас | Sea bass
dorado | Դորադո | Дорадо | Gilt-head bream (dorado)
tuna | Թյունոս | Тунец | Tuna
cod | Ձողաձուկ | Треска | Cod
hake | Խեկ | Хек | Hake
pollock | Մինտայ | Минтай | Pollock
halibut | Պալտուս | Палтус | Halibut
mackerel | Սկումբրիա | Скумбрия | Mackerel
herring | Ծովատառեխ | Сельдь | Herring
anchovy | Անչոուս | Анчоусы | Anchovies
sardine | Սարդինա | Сардины | Sardines
tilapia | Տիլապիա | Тилапия | Tilapia
pangasius | Պանգասիուս | Пангасиус | Pangasius
flounder | Տափակաձուկ | Камбала | Flounder
sole | Սոլ ձուկ | Морской язык | Sole
swordfish | Թրաձուկ | Рыба-меч | Swordfish
eel | Օձաձուկ | Угорь | Eel
fish-heads | Ձկան գլուխներ (ապուրի) | Рыбные головы для ухи | Fish heads (for soup)
smoked-salmon | Ապխտած սաղմոն | Лосось копчёный | Smoked salmon
salted-salmon | Թեթև աղ դրած սաղմոն | Лосось слабосолёный | Lightly salted salmon
smoked-trout | Ապխտած կարմրախայտ | Форель копчёная | Smoked trout
salted-herring | Աղ դրած ծովատառեխ | Сельдь солёная | Salted herring
smoked-mackerel | Ապխտած սկումբրիա | Скумбрия копчёная | Smoked mackerel
red-caviar | Կարմիր խավիար | Икра красная | Red caviar
black-caviar | Սև խավիար | Икра чёрная | Black caviar
`),

  block('seafood', 'Ծովամթերք', 'Морепродукты', 'Seafood', `
shrimp-raw | Հում ծովախեցգետին | Креветки сырые | Raw shrimp
shrimp-cooked | Եփած ծովախեցգետին | Креветки варёные | Cooked shrimp
tiger-prawns | Վագրային ծովախեցգետին | Креветки тигровые | Tiger prawns
king-prawns | Թագավորական ծովախեցգետին | Креветки королевские | King prawns
langoustines | Լանգուստին | Лангустины | Langoustines
crayfish | Խեցգետին | Раки | Crayfish
lobster | Օմար | Омар | Lobster
crab | Կրաբ | Краб | Crab
crab-sticks | Կրաբի ձողիկներ | Крабовые палочки | Crab sticks
squid | Կաղամար | Кальмар | Squid
octopus | Ութոտնուկ | Осьминог | Octopus
cuttlefish | Կարակատիցա | Каракатица | Cuttlefish
mussels | Միդիա (խեցիով) | Мидии в раковинах | Mussels in shell
mussels-meat | Կլպած միդիա | Мидии очищенные | Shelled mussels
clams | Վոնգոլե | Вонголе | Clams (vongole)
scallops | Սանրախեցի | Морские гребешки | Scallops
oysters | Ոստրե | Устрицы | Oysters
seafood-mix | Ծովամթերքի խառնուրդ | Морской коктейль | Seafood mix
`),

  block('dairy', 'Կաթնամթերք', 'Молочные продукты', 'Dairy', `
milk | Կաթ | Молоко | Milk
milk-powder | Կաթի փոշի | Молоко сухое | Milk powder
condensed-milk | Խտացրած կաթ | Сгущённое молоко | Condensed milk
cooking-cream | Խոհարարական սերուցք | Сливки кулинарные | Cooking cream
whipping-cream | Հարելու սերուցք 33% | Сливки для взбивания 33% | Whipping cream 33%
cream-10 | Սերուցք 10% | Сливки 10% | Cream 10%
vegetable-cream | Բուսական սերուցք | Сливки растительные | Non-dairy whipping cream
sour-cream | Թթվասեր | Сметана | Sour cream
matsun | Մածուն | Мацун | Matsun (yogurt)
strained-matsun | Քամած մածուն | Сюзьма (процеженный мацун) | Strained matsun
greek-yogurt | Հունական յոգուրտ | Греческий йогурт | Greek yogurt
kefir | Կեֆիր | Кефир | Kefir
cottage-cheese | Կաթնաշոռ | Творог | Cottage cheese
kaymak | Կայմակ | Каймак | Kaymak (clotted cream)
butter | Կարագ | Сливочное масло | Butter
ghee | Հալած կարագ | Топлёное масло | Ghee (clarified butter)
chortan | Չորթան | Чортан | Chortan (dried yogurt)
`),

  block('cheese', 'Պանիրներ', 'Сыры', 'Cheese', `
lori-cheese | Լոռի պանիր | Сыр Лори | Lori cheese
string-cheese | Չեչիլ պանիր | Сыр чечил | String cheese
chanakh | Չանախ | Чанах | Chanakh cheese
motal | Մոթալ | Мотал | Motal cheese
brynza | Բրինզա | Брынза | Brynza
suluguni | Սուլուգունի | Сулугуни | Suluguni
smoked-suluguni | Ապխտած սուլուգունի | Сулугуни копчёный | Smoked suluguni
imeruli | Իմերուլի | Имеретинский сыр | Imeruli cheese
feta | Ֆետա | Фета | Feta
halloumi | Հալումի | Халуми | Halloumi
mozzarella | Մոցարելլա | Моцарелла | Mozzarella
pizza-mozzarella | Մոցարելլա պիցցայի | Моцарелла для пиццы | Pizza mozzarella
burrata | Բուրատա | Буррата | Burrata
parmesan | Պարմեզան | Пармезан | Parmesan
grana-padano | Գրանա Պադանո | Грана Падано | Grana Padano
pecorino | Պեկորինո | Пекорино | Pecorino
cheddar | Չեդեր | Чеддер | Cheddar
gouda | Գաուդա | Гауда | Gouda
dutch-cheese | Հոլանդական պանիր | Голландский сыр | Dutch-style cheese
emmental | Էմենթալ | Эмменталь | Emmental
gruyere | Գրյուեր | Грюйер | Gruyère
blue-cheese | Կապույտ բորբոսով պանիր | Сыр с голубой плесенью | Blue cheese
gorgonzola | Գորգոնզոլա | Горгонзола | Gorgonzola
brie | Բրի | Бри | Brie
camembert | Կամամբեր | Камамбер | Camembert
goat-cheese | Այծի պանիր | Козий сыр | Goat cheese
ricotta | Ռիկոտա | Рикотта | Ricotta
mascarpone | Մասկարպոնե | Маскарпоне | Mascarpone
cream-cheese | Կրեմ պանիր | Сливочный сыр (крем-чиз) | Cream cheese
processed-cheese | Հալած պանիր | Плавленый сыр | Processed cheese
burger-cheese | Պանիր բուրգերի (շերտեր) | Сыр для бургеров (ломтики) | Burger cheese slices
`),

  block('eggs', 'Ձու', 'Яйца', 'Eggs', `
egg | Ձու | Яйцо | Egg
quail-egg | Լորի ձու | Перепелиное яйцо | Quail egg
duck-egg | Բադի ձու | Утиное яйцо | Duck egg
`),

  block('grains', 'Ձավարեղեն և բրինձ', 'Крупы и рис', 'Grains & rice', `
rice | Բրինձ | Рис | Rice
long-grain-rice | Երկարահատիկ բրինձ | Рис длиннозёрный | Long-grain rice
round-grain-rice | Կլորահատիկ բրինձ | Рис круглозёрный | Round-grain rice
basmati-rice | Բասմատի բրինձ | Рис басмати | Basmati rice
jasmine-rice | Ժասմին բրինձ | Рис жасмин | Jasmine rice
arborio-rice | Արբորիո բրինձ | Рис арборио | Arborio rice
sushi-rice | Սուշիի բրինձ | Рис для суши | Sushi rice
brown-rice | Շագանակագույն բրինձ | Рис бурый | Brown rice
wild-rice | Վայրի բրինձ | Рис дикий | Wild rice
bulgur-fine | Մանր բլղուր | Булгур мелкий | Fine bulgur
bulgur-coarse | Խոշոր բլղուր | Булгур крупный | Coarse bulgur
korkot | Կորկոտ | Коркот | Korkot (hulled wheat)
dzavar | Ձավար | Дзавар | Dzavar (cracked wheat)
wheat-berries | Ցորենի հատիկ | Пшеница (зерно) | Wheat berries
buckwheat | Հնդկաձավար | Гречка | Buckwheat
rolled-oats | Վարսակի փաթիլներ | Овсяные хлопья | Rolled oats
pearl-barley | Գարու ձավար | Перловка | Pearl barley
millet | Կորեկ | Пшено | Millet
semolina | Սեմոլինա (մանկա) | Манная крупа | Semolina
couscous | Կուսկուս | Кускус | Couscous
quinoa | Կինոա | Киноа | Quinoa
corn-grits | Եգիպտացորենի ձավար | Кукурузная крупа | Corn grits (polenta)
corn-flakes | Եգիպտացորենի փաթիլներ | Кукурузные хлопья | Corn flakes
`),

  block('flour-starch', 'Ալյուր և օսլա', 'Мука и крахмал', 'Flour & starch', `
wheat-flour | Ցորենի ալյուր | Пшеничная мука | Wheat flour
pizza-flour | Պիցցայի ալյուր (00) | Мука для пиццы (00) | Pizza flour (00)
whole-wheat-flour | Ամբողջահատիկ ալյուր | Мука цельнозерновая | Whole wheat flour
rye-flour | Տարեկանի ալյուր | Мука ржаная | Rye flour
corn-flour | Եգիպտացորենի ալյուր | Мука кукурузная | Corn flour
rice-flour | Բրնձի ալյուր | Мука рисовая | Rice flour
buckwheat-flour | Հնդկաձավարի ալյուր | Мука гречневая | Buckwheat flour
almond-flour | Նշի ալյուր | Мука миндальная | Almond flour
chickpea-flour | Սիսեռի ալյուր | Мука нутовая | Chickpea flour
potato-starch | Կարտոֆիլի օսլա | Крахмал картофельный | Potato starch
corn-starch | Եգիպտացորենի օսլա | Крахмал кукурузный | Corn starch
breadcrumbs | Պաքսիմատի փշրանք | Панировочные сухари | Breadcrumbs
panko | Պանկո | Панко | Panko breadcrumbs
tempura-flour | Տեմպուրայի խառնուրդ | Смесь для темпуры | Tempura batter mix
`),

  block('pasta', 'Մակարոնեղեն և լապշա', 'Макароны и лапша', 'Pasta & noodles', `
vermicelli | Արիշտա | Вермишель | Vermicelli
spaghetti | Սպագետտի | Спагетти | Spaghetti
penne | Պեննե | Пенне | Penne
fusilli | Ֆուզիլի | Фузилли | Fusilli
farfalle | Ֆարֆալլե | Фарфалле | Farfalle
rigatoni | Ռիգատոնի | Ригатони | Rigatoni
tagliatelle | Տալյատելլե | Тальятелле | Tagliatelle
fettuccine | Ֆետուչինի | Феттуччине | Fettuccine
linguine | Լինգվինի | Лингвини | Linguine
pappardelle | Պապարդելլե | Паппарделле | Pappardelle
lasagna-sheets | Լազանյայի թերթեր | Листы для лазаньи | Lasagna sheets
cannelloni | Կաննելոնի | Каннеллони | Cannelloni
orzo | Օրզո | Орзо | Orzo
macaroni | Մակարոն (եղջյուրիկ) | Макароны рожки | Elbow macaroni
egg-noodles | Ձվով լապշա | Лапша яичная | Egg noodles
gnocchi | Նյոկի | Ньокки | Gnocchi
udon | Ուդոն | Удон | Udon noodles
soba | Սոբա | Соба | Soba noodles
rice-noodles | Բրնձի լապշա | Лапша рисовая | Rice noodles
glass-noodles | Ֆունչոզա | Фунчоза | Glass noodles
ramen-noodles | Ռամենի լապշա | Лапша для рамена | Ramen noodles
`),

  block('legumes', 'Լոբազգիներ', 'Бобовые', 'Legumes', `
chickpeas | Սիսեռ | Нут | Chickpeas
red-beans | Կարմիր լոբի | Фасоль красная | Red kidney beans
white-beans | Սպիտակ լոբի | Фасоль белая | White beans
black-beans | Սև լոբի | Фасоль чёрная | Black beans
red-lentils | Կարմիր ոսպ | Чечевица красная | Red lentils
green-lentils | Կանաչ ոսպ | Чечевица зелёная | Green lentils
split-peas | Կիսված ոլոռ | Горох колотый | Split peas
mung-beans | Մաշ | Маш | Mung beans
broad-beans | Բակլա | Бобы | Broad beans
soybeans | Սոյա | Соя | Soybeans
`),

  block('bakery', 'Հաց և խմոր', 'Хлеб и тесто', 'Bread & dough', `
lavash | Լավաշ | Лаваш | Lavash
matnakash | Մատնաքաշ | Матнакаш | Matnakash bread
white-bread | Սպիտակ հաց | Хлеб белый | White bread
toast-bread | Տոստի հաց | Хлеб тостовый | Sandwich bread
rye-bread | Տարեկանի հաց | Хлеб ржаной | Rye bread
baguette | Բագետ | Багет | Baguette
ciabatta | Չիաբատա | Чиабатта | Ciabatta
burger-buns | Բուրգերի բուլկի | Булочки для бургеров | Burger buns
hot-dog-buns | Հոթ-դոգի բուլկի | Булочки для хот-догов | Hot dog buns
pita | Պիտա | Пита | Pita bread
tortilla | Տորտիլյա | Тортилья | Tortilla wraps
pizza-base | Պիցցայի հիմք | Основа для пиццы | Pizza base
puff-pastry | Շերտավոր խմոր | Тесто слоёное | Puff pastry
yeast-dough | Խմորիչով խմոր | Тесто дрожжевое | Yeast dough
phyllo-dough | Ֆիլո խմոր | Тесто фило | Phyllo dough
kataifi | Կադաիֆ | Кадаиф | Kataifi
`),

  block('oils-fats', 'Յուղեր և ճարպեր', 'Масла и жиры', 'Oils & fats', `
sunflower-oil | Արևածաղկի յուղ | Подсолнечное масло | Sunflower oil
olive-oil-extra-virgin | Ձիթապտղի յուղ Extra Virgin | Оливковое масло Extra Virgin | Extra virgin olive oil
olive-oil-refined | Ձիթապտղի զտված յուղ | Оливковое масло рафинированное | Refined olive oil
corn-oil | Եգիպտացորենի յուղ | Кукурузное масло | Corn oil
rapeseed-oil | Ռապսի յուղ | Рапсовое масло | Rapeseed (canola) oil
sesame-oil | Քունջութի յուղ | Кунжутное масло | Sesame oil
frying-oil | Ֆրիտյուրի յուղ | Фритюрное масло | Deep-frying oil
coconut-oil | Կոկոսի յուղ | Кокосовое масло | Coconut oil
truffle-oil | Տրյուֆելի յուղ | Трюфельное масло | Truffle oil
walnut-oil | Ընկույզի յուղ | Масло грецкого ореха | Walnut oil
margarine | Մարգարին | Маргарин | Margarine
lard | Հալած խոզի ճարպ | Смалец | Lard
`),

  block('spices', 'Համեմունքներ և աղ', 'Специи и соль', 'Spices & salt', `
salt | Աղ | Соль | Salt
sea-salt | Ծովի աղ | Морская соль | Sea salt
flaky-salt | Փաթիլավոր աղ | Соль хлопьями | Flaky salt
svan-salt | Սվանական աղ | Сванская соль | Svan salt
black-pepper-ground | Աղացած սև պղպեղ | Перец чёрный молотый | Ground black pepper
black-peppercorns | Սև պղպեղ հատիկ | Перец чёрный горошек | Black peppercorns
white-pepper | Սպիտակ պղպեղ | Перец белый | White pepper
pink-peppercorns | Վարդագույն պղպեղ | Перец розовый | Pink peppercorns
allspice | Անուշահոտ պղպեղ | Перец душистый | Allspice
red-pepper-ground | Աղացած կարմիր պղպեղ | Перец красный молотый | Ground red pepper
chili-flakes | Կծու պղպեղի փաթիլներ | Хлопья чили | Chili flakes
dried-chili | Չոր կծու պղպեղ | Перец чили сушёный | Dried chili peppers
cayenne-pepper | Կայեն պղպեղ | Перец кайенский | Cayenne pepper
paprika-sweet | Քաղցր պապրիկա | Паприка сладкая | Sweet paprika
paprika-smoked | Ապխտած պապրիկա | Паприка копчёная | Smoked paprika
cumin | Քեմոն (զիրա) | Зира (кумин) | Cumin
coriander-seeds | Համեմի սերմեր | Кориандр | Coriander seeds
chaman | Չաման | Чаман (пажитник) | Chaman (ground fenugreek)
turmeric | Քրքում | Куркума | Turmeric
curry-powder | Կարրի | Карри | Curry powder
garam-masala | Գարամ մասալա | Гарам масала | Garam masala
cinnamon-ground | Աղացած դարչին | Корица молотая | Ground cinnamon
cinnamon-sticks | Դարչինի ձողիկներ | Корица палочки | Cinnamon sticks
cloves | Մեխակ | Гвоздика | Cloves
nutmeg | Մշկընկույզ | Мускатный орех | Nutmeg
cardamom | Հիլ | Кардамон | Cardamom
star-anise | Աստղանիսոն | Бадьян | Star anise
fennel-seeds | Ռազիանայի սերմեր | Семена фенхеля | Fennel seeds
mustard-seeds | Մանանեխի սերմեր | Горчичные семена | Mustard seeds
bay-leaf | Դափնու տերև | Лавровый лист | Bay leaves
dried-basil | Չոր ռեհան | Базилик сушёный | Dried basil
dried-oregano | Չոր օրեգանո | Орегано сушёный | Dried oregano
dried-thyme | Չոր ուրց | Тимьян сушёный | Dried thyme
dried-rosemary | Չոր ռոզմարին | Розмарин сушёный | Dried rosemary
dried-mint | Չոր անանուխ | Мята сушёная | Dried mint
dried-dill | Չոր սամիթ | Укроп сушёный | Dried dill
dried-tarragon | Չոր թարխուն | Тархун сушёный | Dried tarragon
italian-herbs | Իտալական խոտաբույսեր | Итальянские травы | Italian herbs
provence-herbs | Պրովանսալ խոտաբույսեր | Прованские травы | Herbes de Provence
khmeli-suneli | Խմելի-սունելի | Хмели-сунели | Khmeli suneli
utskho-suneli | Ուցխո-սունելի | Уцхо-сунели | Utskho suneli
sumac | Սումախ | Сумах | Sumac
barberry-dried | Չորացրած ծորենի | Барбарис сушёный | Dried barberries
saffron | Զաֆրան | Шафран | Saffron
zaatar | Զաաթար | Заатар | Za'atar
garlic-powder | Սխտորի փոշի | Чеснок сушёный молотый | Garlic powder
onion-powder | Սոխի փոշի | Лук сушёный молотый | Onion powder
ginger-ground | Աղացած կոճապղպեղ | Имбирь молотый | Ground ginger
msg | Նատրիումի գլուտամատ | Глутамат натрия | MSG
meat-seasoning | Մսի համեմունք | Приправа для мяса | Meat seasoning
khorovats-seasoning | Խորովածի համեմունք | Приправа для шашлыка | BBQ (khorovats) seasoning
chicken-seasoning | Հավի համեմունք | Приправа для курицы | Chicken seasoning
fish-seasoning | Ձկան համեմունք | Приправа для рыбы | Fish seasoning
potato-seasoning | Կարտոֆիլի համեմունք | Приправа для картофеля | Potato seasoning
`),

  block('sauces', 'Սոուսներ, քացախ և արգանակներ', 'Соусы, уксусы и бульоны', 'Sauces, vinegars & stocks', `
ketchup | Կետչուպ | Кетчуп | Ketchup
mayonnaise | Մայոնեզ | Майонез | Mayonnaise
mustard | Մանանեխ | Горчица | Mustard
dijon-mustard | Դիժոնի մանանեխ | Горчица дижонская | Dijon mustard
grain-mustard | Հատիկավոր մանանեխ | Горчица зернистая | Wholegrain mustard
horseradish-sauce | Ծովաբողկի սոուս | Хрен столовый | Prepared horseradish
tomato-paste | Տոմատի մածուկ | Томатная паста | Tomato paste
pepper-paste | Պղպեղի մածուկ | Перцовая паста | Pepper paste
passata | Պասատա | Пассата | Passata
pizza-sauce | Պիցցայի տոմատի սոուս | Томатный соус для пиццы | Pizza sauce
pesto | Պեստո | Песто | Pesto
adjika | Աջիկա | Аджика | Adjika
tkemali | Տկեմալի | Ткемали | Tkemali (plum sauce)
narsharab | Նարշարաբ | Наршараб | Narsharab (pomegranate sauce)
tahini | Թահինի | Тахини | Tahini
soy-sauce | Սոյայի սոուս | Соевый соус | Soy sauce
teriyaki-sauce | Թերիյակի սոուս | Соус терияки | Teriyaki sauce
worcestershire-sauce | Վուստերշիր սոուս | Вустерширский соус | Worcestershire sauce
tabasco | Տաբասկո | Табаско | Tabasco
sriracha | Շրիրաչա | Шрирача | Sriracha
sweet-chili-sauce | Քաղցր չիլի սոուս | Соус сладкий чили | Sweet chili sauce
bbq-sauce | Բարբեքյու սոուս | Соус барбекю | BBQ sauce
caesar-dressing | Կեսար սոուս | Соус Цезарь | Caesar dressing
tartar-sauce | Թարթար սոուս | Соус тартар | Tartar sauce
cheese-sauce | Պանրի սոուս | Сырный соус | Cheese sauce
garlic-sauce | Սխտորի սոուս | Чесночный соус | Garlic sauce
balsamic-vinegar | Բալզամիկ քացախ | Уксус бальзамический | Balsamic vinegar
balsamic-glaze | Բալզամիկ կրեմ | Бальзамический крем | Balsamic glaze
red-wine-vinegar | Կարմիր գինու քացախ | Уксус винный красный | Red wine vinegar
white-wine-vinegar | Սպիտակ գինու քացախ | Уксус винный белый | White wine vinegar
apple-cider-vinegar | Խնձորի քացախ | Уксус яблочный | Apple cider vinegar
table-vinegar | Սեղանի քացախ 9% | Уксус столовый 9% | Table vinegar 9%
lemon-juice | Կիտրոնի հյութ (խոհարարական) | Лимонный сок (кулинарный) | Lemon juice (for cooking)
chicken-stock | Հավի արգանակ | Бульон куриный | Chicken stock
beef-stock | Տավարի արգանակ | Бульон говяжий | Beef stock
vegetable-stock | Բանջարեղենի արգանակ | Бульон овощной | Vegetable stock
bouillon-cubes | Արգանակի խորանարդիկներ | Бульонные кубики | Bouillon cubes
demi-glace | Դեմի-գլաս | Демиглас | Demi-glace
`),

  block('canned', 'Պահածոներ և թթուներ', 'Консервы и соления', 'Canned & pickled', `
olives-green | Կանաչ ձիթապտուղ | Оливки зелёные | Green olives
olives-black | Սև ձիթապտուղ | Маслины | Black olives
capers | Կապար | Каперсы | Capers
pickled-cucumbers | Թթու վարունգ | Огурцы маринованные | Pickled cucumbers
cornichons | Մարինացված կորնիշոն | Корнишоны маринованные | Cornichons
pickled-jalapenos | Մարինացված խալապենյո | Халапеньо маринованный | Pickled jalapeños
sauerkraut | Թթու կաղամբ | Квашеная капуста | Sauerkraut
mixed-pickles | Թթու (խառը) | Соленья ассорти | Mixed pickles
pickled-garlic | Թթու սխտոր | Чеснок маринованный | Pickled garlic
pickled-mushrooms | Մարինացված սունկ | Грибы маринованные | Pickled mushrooms
brined-grape-leaves | Աղաջրած խաղողի տերև | Виноградные листья в рассоле | Brined grape leaves
roasted-peppers | Թխած մարինացված պղպեղ | Перец печёный маринованный | Roasted peppers in brine
sun-dried-tomatoes | Արևաչոր լոլիկ | Томаты вяленые | Sun-dried tomatoes
canned-tomatoes | Պահածոյացված լոլիկ | Томаты в собственном соку | Canned tomatoes
canned-corn | Պահածոյացված եգիպտացորեն | Кукуруза консервированная | Canned sweet corn
canned-peas | Պահածոյացված կանաչ ոլոռ | Горошек консервированный | Canned green peas
canned-beans | Պահածոյացված լոբի | Фасоль консервированная | Canned beans
canned-chickpeas | Պահածոյացված սիսեռ | Нут консервированный | Canned chickpeas
canned-tuna | Թյունոսի պահածո | Тунец консервированный | Canned tuna
sprats | Շպրոտ | Шпроты | Sprats
canned-pineapple | Պահածոյացված արքայախնձոր | Ананасы консервированные | Canned pineapple
canned-peaches | Պահածոյացված դեղձ | Персики консервированные | Canned peaches
canned-artichokes | Պահածոյացված արտիճուկ | Артишоки консервированные | Canned artichoke hearts
`),

  block('sweeteners', 'Շաքար և օշարակներ', 'Сахар и сиропы', 'Sugar & syrups', `
sugar | Շաքարավազ | Сахар | Sugar
brown-sugar | Շագանակագույն շաքար | Сахар коричневый | Brown sugar
powdered-sugar | Շաքարի փոշի | Сахарная пудра | Powdered sugar
glucose-syrup | Գլյուկոզայի օշարակ | Сироп глюкозы | Glucose syrup
maple-syrup | Թխկու օշարակ | Кленовый сироп | Maple syrup
caramel-sauce | Կարամելի սոուս | Карамельный соус | Caramel sauce
chocolate-topping | Շոկոլադե տոպինգ | Топпинг шоколадный | Chocolate topping
`),

  block('pantry', 'Մթերանոց', 'Бакалея', 'Pantry', `
honey | Մեղր | Мёд | Honey
doshab | Դոշաբ | Дошаб (бекмес) | Doshab (grape molasses)
jam-apricot | Ծիրանի ջեմ | Джем абрикосовый | Apricot jam
jam-strawberry | Ելակի ջեմ | Джем клубничный | Strawberry jam
jam-cherry | Բալի ջեմ | Джем вишнёвый | Sour cherry jam
dulce-de-leche | Եփած խտացրած կաթ | Варёная сгущёнка | Dulce de leche
chocolate-spread | Շոկոլադե պաստա | Шоколадная паста | Chocolate spread
peanut-butter | Գետնանուշի կարագ | Арахисовая паста | Peanut butter
rose-water | Վարդաջուր | Розовая вода | Rose water
`),

  block('baking', 'Հրուշակագործական հումք', 'Кондитерское сырьё', 'Baking & pastry', `
dry-yeast | Չոր խմորիչ | Дрожжи сухие | Dry yeast
fresh-yeast | Թարմ խմորիչ | Дрожжи прессованные | Fresh yeast
baking-powder | Փխրեցուցիչ | Разрыхлитель | Baking powder
baking-soda | Խմելու սոդա | Сода пищевая | Baking soda
citric-acid | Կիտրոնաթթու | Лимонная кислота | Citric acid
vanilla-sugar | Վանիլային շաքար | Ванильный сахар | Vanilla sugar
vanillin | Վանիլին | Ванилин | Vanillin
vanilla-extract | Վանիլի էքստրակտ | Экстракт ванили | Vanilla extract
vanilla-pod | Վանիլի պատիճ | Ваниль в стручках | Vanilla pods
gelatin | Ժելատին | Желатин | Gelatin
agar-agar | Ագար-ագար | Агар-агар | Agar-agar
cocoa-powder | Կակաոյի փոշի | Какао-порошок | Cocoa powder
dark-chocolate | Մուգ շոկոլադ | Шоколад тёмный | Dark chocolate
milk-chocolate | Կաթնային շոկոլադ | Шоколад молочный | Milk chocolate
white-chocolate | Սպիտակ շոկոլադ | Шоколад белый | White chocolate
chocolate-chips | Շոկոլադե կաթիլներ | Шоколадные капли | Chocolate chips
cocoa-butter | Կակաոյի կարագ | Какао-масло | Cocoa butter
marzipan | Մարցիպան | Марципан | Marzipan
fondant | Շաքարային մաստիկա | Сахарная мастика | Fondant
pistachio-paste | Պիստակի մածուկ | Фисташковая паста | Pistachio paste
hazelnut-paste | Պնդուկի մածուկ (պրալինե) | Ореховая паста (пралине) | Hazelnut praline paste
candied-fruit | Ցուկատ | Цукаты | Candied fruit
sprinkles | Հրուշակային զարդափոշի | Кондитерская посыпка | Sprinkles
food-coloring | Սննդային ներկ | Пищевой краситель | Food coloring
ladyfingers | Սավոյարդի թխվածքաբլիթ | Печенье савоярди | Ladyfingers (savoiardi)
`),

  block('asian', 'Ասիական մթերքներ', 'Азиатские продукты', 'Asian ingredients', `
nori | Նորի | Нори | Nori
wasabi | Վասաբի | Васаби | Wasabi
pickled-ginger | Մարինացված կոճապղպեղ | Имбирь маринованный | Pickled ginger
rice-vinegar | Բրնձի քացախ | Рисовый уксус | Rice vinegar
mirin | Միրին | Мирин | Mirin
fish-sauce | Ձկան սոուս | Рыбный соус | Fish sauce
oyster-sauce | Ոստրեի սոուս | Устричный соус | Oyster sauce
hoisin-sauce | Հոյսին սոուս | Соус хойсин | Hoisin sauce
unagi-sauce | Ունագի սոուս | Соус унаги | Unagi sauce
miso-paste | Միսո մածուկ | Паста мисо | Miso paste
gochujang | Գոչուջանգ | Кочхуджан | Gochujang
red-curry-paste | Կարմիր կարրիի մածուկ | Паста карри красная | Red curry paste
tom-yum-paste | Թոմ յամ մածուկ | Паста том ям | Tom yum paste
coconut-milk | Կոկոսի կաթ | Кокосовое молоко | Coconut milk
tofu | Տոֆու | Тофу | Tofu
kimchi | Կիմչի | Кимчи | Kimchi
tobiko | Տոբիկո | Икра тобико | Tobiko (flying fish roe)
unagi | Ապխտած օձաձուկ (ունագի) | Угорь копчёный (унаги) | Smoked eel (unagi)
spring-roll-wrappers | Սփրինգ ռոլի թերթիկներ | Листы для спринг-роллов | Spring roll wrappers
rice-paper | Բրնձի թուղթ | Рисовая бумага | Rice paper
gyoza-wrappers | Գյոզայի թերթիկներ | Тесто для гёдза | Gyoza wrappers
bamboo-shoots | Բամբուկի ընձյուղներ | Побеги бамбука | Bamboo shoots
kaffir-lime-leaves | Կաֆիր լայմի տերևներ | Листья каффир-лайма | Kaffir lime leaves
sesame-dressing | Քունջութի սոուս | Кунжутный соус | Sesame dressing
`),

  block('frozen', 'Սառեցված կիսաֆաբրիկատներ', 'Замороженные полуфабрикаты', 'Frozen & semi-finished', `
french-fries | Ֆրի կարտոֆիլ (սառեցված) | Картофель фри замороженный | Frozen french fries
potato-wedges | Կարտոֆիլի դոլկաներ (սառեցված) | Картофельные дольки замороженные | Frozen potato wedges
hash-browns | Կարտոֆիլի կոտլետներ (հեշբրաուն) | Картофельные оладьи (хашбраун) | Hash browns
frozen-mixed-vegetables | Սառեցված բանջարեղենի խառնուրդ | Овощная смесь замороженная | Frozen mixed vegetables
frozen-spinach | Սառեցված սպանախ | Шпинат замороженный | Frozen spinach
frozen-berries | Սառեցված հատապտուղների խառնուրդ | Ягодная смесь замороженная | Frozen mixed berries
onion-rings | Սոխի օղակներ (սառեցված) | Луковые кольца замороженные | Frozen onion rings
pelmeni | Պելմենի | Пельмени | Pelmeni
khinkali | Խինկալի (սառեցված) | Хинкали замороженные | Frozen khinkali
chicken-nuggets | Հավի նագեթս | Куриные наггетсы | Chicken nuggets
burger-patties | Բուրգերի կոտլետներ | Котлеты для бургеров | Burger patties
fish-fingers | Ձկան ձողիկներ | Рыбные палочки | Fish fingers
mozzarella-sticks | Մոցարելլայի ձողիկներ | Сырные палочки моцарелла | Mozzarella sticks
vanilla-ice-cream | Վանիլային պաղպաղակ | Мороженое пломбир | Vanilla ice cream
`),
];

function parse(blocks: Block[]): { categories: KitchenCategory[]; items: KitchenItem[] } {
  const categories: KitchenCategory[] = [];
  const items: KitchenItem[] = [];
  for (const b of blocks) {
    categories.push(b.category);
    for (const raw of b.rows.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const parts = line.split('|').map((s) => s.trim());
      if (parts.length !== 4 || parts.some((p) => !p)) {
        throw new Error(`kitchen-catalog: bad row in "${b.category.slug}": ${line}`);
      }
      const [slug, nameHy, nameRu, nameEn] = parts as [string, string, string, string];
      const baseUnit = UNIT_OVERRIDES[slug] ?? CATEGORY_UNIT[b.category.slug] ?? 'GRAM';
      items.push({ slug, nameHy, nameRu, nameEn, categorySlug: b.category.slug, baseUnit });
    }
  }
  return { categories, items };
}

const parsed = parse(BLOCKS);

/** Categories in display order. */
export const KITCHEN_CATEGORIES: KitchenCategory[] = parsed.categories;
/** Every catalog item (category by slug). */
export const KITCHEN_ITEMS: KitchenItem[] = parsed.items;
