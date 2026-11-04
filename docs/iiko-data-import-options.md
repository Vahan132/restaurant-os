# Importing iiko data into Restaurant OS

Scope: recipes, menu items, items (products and semi-finished goods), and sales.
Checked on 2026-09-28 in iikoChain 9.2 (Bek Beer). Nothing was changed in iiko.

## What we found

### 1. The iiko REST API is licensed (best option)

*Administration → License setup* shows active API licences until 10/6/2026:

| Module | Qty |
|---|---|
| API (RestApi) | 108 |
| API (RestAPI) | 2 |
| API (ApiEmployees) | 100 |
| API (ApiEvents) | 99 |
| Chain (Store Connector) | 2 |
| Dashboard Olap Extension | 1 |

The server comes from `%AppData%\iiko\Chain\Default\config\backclient.config.xml`:
`https://bek-beer-co.iiko.it:443/resto`. It's iiko cloud, so our API can reach it over the internet. We couldn't test it from this session because the sandbox proxy blocks the host.

The licence expires on **10/6/2026**, so pull everything before then or confirm renewal.

### 2. Built-in Excel exports in iikoOffice (fallback)

- *Inventory Management → Products → Actions → Export to Excel* exports the full product list (dishes, goods, semi-finished, modifiers, groups, SKU/code, unit, price).
- *Products → Actions → Print whole list of recipes* exports all recipes (can be saved to Excel).
- *Reports → Sales → OLAP Sales report* can group by any field and export to Excel.
- *Data Exchange → 1C → Export to External System* produces 1C XML for accounting documents. Not useful for us.

### 3. Existing Excel files on the PC

`Downloads` and `Documents` contain no iiko exports. `sales_2026-09-01_2026-09-26.xlsx` and `profit_2026-09-25_…xlsx` came from our own reports. The iiko local cache (`EntitiesCache`) is empty.

### 4. What our platform already has

- `catalog` module: `CatalogBundle` JSON with `CatalogImportService` (DRY_RUN/APPLY, SKIP/OVERWRITE, one transaction). It covers inventory categories, suppliers, inventory items, processes, menu categories, menu items with modifiers, and recipes.
- `sales-import` module: `POST /sales-import` CSV takes `ImportedSale` rows (reports only, never fiscal, never depletes stock) and dedupes by `externalReference`.

So the job is an **iiko adapter** that turns iiko data into those two existing inputs. We don't need new import engines.

## Mapping iiko → Restaurant OS

| iiko | Endpoint (iikoServer API) | Ours |
|---|---|---|
| Product groups | `GET /resto/api/v2/entities/products/group/list` | `MenuCategory` (dish groups) / `InventoryCategory` (goods groups) |
| Products `type=GOODS` | `GET /resto/api/v2/entities/products/list` | `InventoryItem` kind RAW |
| Products `type=PREPARED` (semi-finished) | same | `InventoryItem` kind PROCESSED + `Process` built from its tech card |
| Products `type=DISH` | same | `MenuItem` (code → key, name, price) |
| Products `type=MODIFIER` + modifier schemes | same (`modifiers` on product) | `ModifierGroup` / `ModifierOption` |
| Measure units | `GET /resto/api/v2/entities/list?rootType=MeasureUnit` | kg→GRAM ×1000, l→MILLILITER ×1000, pcs→PIECE |
| Tech cards (assembly charts) | `GET /resto/api/v2/assemblyCharts/getAll?dateFrom=…&dateTo=…` | `Recipe` + `RecipeLine`: `amountIn` = brutto → `baseQty`, `amountOut` = netto → `netQty` (fits BRUTTO-1 exactly) |
| Prices | `GET /resto/api/v2/price?…` (or product default price) | `MenuItem.priceAmount` (minor units) |
| Departments / stores | `GET /resto/api/corporation/departments`, `/corporation/stores` | `Branch` mapping (manual pick in UI) |
| Sales | `POST /resto/api/v2/reports/olap` with `reportType: SALES`, grouped by `OpenDate.Typed`, `Department`, `UniqOrderId.Id`, `DishId`, `DishName`, `PayTypes`, with aggregates `DishAmountInt`, `DishSumInt`, `DishDiscountSumInt` | `ImportedSale` with `externalReference = iiko:<orderId>:<dishId>` |

Auth: `GET /resto/api/auth?login=<user>&pass=<sha1(password)>` returns a token as `?key=`. Always call `/resto/api/logout` afterwards, because each open token holds a licence seat. Use a **dedicated iiko user** for the API, not a person's login.

Endpoint names and OLAP fields are from the public iikoServer API docs. Check each one against this server's version (9.2) on the first run.

## Options

**A. Direct API connector (recommended)**
New `iiko-integration` module in `api`:
1. Settings page: server URL + API login/password (stored encrypted), "Test connection".
2. Pull, then map to a `CatalogBundle`, then run `CatalogImportService` in **DRY_RUN** and show the report (creates/updates/errors).
3. The user confirms, then **APPLY**.
4. Sales: pick date range + iiko department → branch mapping. Pull OLAP in monthly chunks and write `ImportedSale` rows. This needs a small refactor so the sales-import use case accepts parsed rows, not only CSV text.
5. Optional later: nightly incremental sync while running both systems in parallel.

Pros: complete and repeatable, no manual steps, idempotent re-runs. Cons: needs API credentials, the licence expires soon, and there's more code to write.

**B. Excel upload (fallback / no API access)**
The user exports from iikoOffice (Products → Export to Excel, recipes list, OLAP sales). We add parsers that turn those columns into the same `CatalogBundle`, or sales rows into the existing sales CSV importer.
Pros: works without API access. Cons: manual, export column layouts depend on grid settings, and the recipe export is a print form that's harder to parse reliably.

**C. One-off migration script**
A CLI script (`api/scripts/iiko-migrate.ts`) that runs option A's logic once per restaurant, with no UI.
Pros: fastest to build for Bek Beer. Cons: not a product feature for other iiko customers.

Suggested path: build **C first on option A's services**, so the mapping code is reusable, and migrate Bek Beer before the 10/6 licence date. Then wrap it in the settings/UI flow (A). Keep B as a later fallback.

## Open questions

- Which iiko user and password should be used for the API (a dedicated one is best)?
- How far back should sales go?
- Which iiko departments map to which of our branches?
- Should dish prices come from the price list per department or from the default price?
