# AUDIT-6 — Adopted-Item Name Search & Sort (findings, READ-ONLY)

All anchors `api/…`. Adopted item = `InventoryItem.name = null` +
`catalogItemId` set (`prisma/schema.prisma:1374`, `:1402`); display name resolves
live from `CatalogItem.nameHy/Ru/En` (`prisma/schema.prisma:2104-2106`).

## ADOPTED-ITEM SEARCH/SORT

- **name-search sites:**
  - `src/modules/inventory/infrastructure/persistence/prisma-inventory-item.repository.ts:22`
    — `filter.search ? { name: { contains: …, mode: 'insensitive' } }`. Matches the
    local `name` column ONLY. Feeds `GET /inventory/items`
    (`presentation/http/inventory-items.controller.ts:73-99` →
    `application/queries/list-inventory-items.usecase.ts:41`). Adopted items
    (`name=null`) can never match — they are invisible to search.
  - `src/modules/inventory/infrastructure/persistence/prisma-inventory-stock.reader.ts:29`
    — identical `name contains` clause on the stock read model. Same blind spot.
  - Absence (a finding): no other InventoryItem name-search exists.
    `prisma-menu-item.lookup.ts:32` searches `MenuItem.name` (dish search for recipe
    lookup), not InventoryItem. Category/location/supplier/process name searches hit
    their own **non-nullable** local `name` columns — not adopted-item-affected.

- **name-sort sites (null ordering + pagination):**
  - `prisma-inventory-item.repository.ts:29` — `orderBy: { name: 'asc' }`, DB-level.
    Postgres default is **NULLS LAST** on ASC, so adopted items cluster at the END.
    `skip`/`take` are applied in the same query (`:27-28`) → adopted items get pushed
    onto the final page(s).
  - `prisma-inventory-stock.reader.ts:34` — `orderBy: { name: 'asc' }`, DB-level
    (**NULLS LAST**). Pagination is applied **in memory after** the DB sort
    (`slice` at `:109`), over the DB-ordered array → adopted still land last.
  - `prisma-inventory-report.reader.ts:189-193` — **in-memory** `rows.sort` on
    `(a.itemName ?? '').localeCompare(…)`. Null is coerced to `''`, which sorts
    **FIRST** → adopted items cluster at the TOP here (opposite of the two DB sorts;
    an inconsistency worth flagging). Pagination applied after, `stockOnHand` at `:36`.
  - Not a name-sort: `prisma-low-stock-alert.reader.ts:30` orders by `status`/`raisedAt`
    (itemName is null for adopted at `:59` but ordering is unaffected).

- **catalog reader can search by name:** **Split.**
  - `CATALOG_ITEM_READER` (`platform-catalog/domain/repositories/catalog-item.reader.ts:31-52`;
    impl `…/persistence/prisma-catalog-item.reader.ts`) — **NO.** Forward-resolve only
    (`getResolution`/`getResolutions` by id). Doc: "exposes NO way to list adopters …
    only resolves a catalogItemId forward" (ADR §4).
  - **But** a sibling reader already searches by name across all three locales:
    `CatalogBrowseReader.listActive`
    (`…/persistence/prisma-catalog-browse.reader.ts:67-75`) — `OR` over `slug` +
    `nameHy/nameRu/nameEn` `contains` insensitive, returns views incl. `id`. The
    "return ids whose trilingual name matches a term" capability **already exists** →
    not a new reader capability.
  - And it is already reachable from inventory: `inventory.module.ts:176` imports
    `PlatformCatalogModule`; `application/commands/adopt-catalog-item.usecase.ts:52`
    already injects `CATALOG_BROWSE_READER`. No new cross-module wiring needed.

- **expressible as single Prisma query:** **NO.** `catalogItemId` is a plain scalar
  with no FK / no Prisma relation (`schema.prisma:1402`; ADR §4). Prisma cannot
  express `… OR catalog.name ILIKE …` across an unmapped scalar. Only raw SQL or a
  two-step resolve can span the two tables.

- **viable approaches (fit):**
  - (a) raw SQL join on the unmapped `catalogItemId` — possible, but **no precedent**
    in these readers, breaks the ORM boundary, loses Prisma typing.
  - (b) **two-step** — browse-search catalog ids first, then
    `where: { OR: [{ name: { contains } }, { catalogItemId: { in: matchedIds } }] }`.
    **Matches the codebase's canonical cross-aggregate search pattern**:
    `list-recipes.usecase.ts:40` calls `searchMenuItemIds` →
    `prisma-recipe.repository.ts:20` filters `menuItemId: { in: … }`. Best fit.
  - (c) denormalized searchable-name column on InventoryItem — conflicts with the
    deliberate "NO denormalized copy" ADR §3 (`schema.prisma:1391-1395`).

- **search locale scope:** The list/stock endpoints pass **no locale** today
  (`ListInventoryItemsQuery`: page/limit/categoryId/kind/search only,
  `application/dto/item.dto.ts:149-179`; `StockQuery` similarly, `dto/stock-query.dto.ts:7`).
  Names return trilingual and the **client** picks the locale
  (`dto/responses.ts:36`; resolver contract
  `application/services/inventory-item-name.resolver.ts:21-23`:
  `catalogName ? catalogName[locale] : name`). The existing catalog browse search
  already matches **any-of-three** (`nameHy/Ru/En OR`). Recommend **any-of-three** for
  search (locale-agnostic, consistent, no new param).

- **denormalized-column blast radius:** Would be written at adopt time
  (`adopt-catalog-item.usecase.ts`) **and on every catalog name edit**
  (`platform-catalog/application/commands/update-catalog-item.usecase.ts`,
  `import-catalog-items.usecase.ts`). Catalog edits must **fan out** to every adopted
  `InventoryItem` across all tenants → **catalog edits must fan out: YES.** Conflicts
  with the whole point of live resolution ("a platform name fix propagates to every
  tenant", `schema.prisma:1391-1395`) and crosses ADR §4 (platform editor must not
  reach into tenant inventory) → **conflicts with no-copy ADR: YES.**

### RECOMMENDATION

- **search fix:** two-step (b). In `prisma-inventory-item.repository.ts` and
  `prisma-inventory-stock.reader.ts`, when `search` is present, first resolve matching
  catalog ids via the already-injectable `CatalogBrowseReader` (any-of-three locales),
  then `where.OR = [{ name: { contains, mode:'insensitive' } }, { catalogItemId: { in: ids } }]`.
  Reuses the sanctioned browse port (no ORM join), mirrors the recipe-search precedent,
  keeps the catalog as sole authority (no denormalized copy).
- **sort fix:** stop relying on a DB `orderBy name` for adopted-inclusive lists — a
  null local column can't order adopted rows meaningfully (and the current DB vs
  in-memory paths disagree on where nulls land). Resolve the page's names (already
  batched, no N+1, in the controller/use-case) and **sort in the application layer on
  the effective display name**, as `prisma-inventory-report.reader.ts:189` already does
  in memory. Trade-off: sort-then-paginate must move to the app layer for the item and
  stock lists too (resolve the candidate set, then sort + slice).
- **new reader capability needed:** **NO** for search — `CatalogBrowseReader` already
  searches all three locales, returns ids, and is already wired into inventory. (An
  optional ids-only projection would be a convenience, not a requirement.)
- **respects no-denormalized-copy ADR:** **YES** — two-step search + application-layer
  sort keep names resolving live from the catalog; no fan-out, no stored copy.
