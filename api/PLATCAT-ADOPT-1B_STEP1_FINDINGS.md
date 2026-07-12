# PLATCAT-ADOPT-1B — STEP 1 FINDINGS (inspection only, no code)

Findings-first report per the ticket. Anchors are `path:line`. Nothing below is
implemented yet; this decides the blast radius for Step 2.

---

## 1. Every consumer of `InventoryItem.name`

Grouped by whether it **writes**, **reads for display**, or **reads as a key/filter**.
The important result: the live-resolve pattern the ticket wants **already exists and
is already correct** in the dish resolver — everything else is the gap.

### Already-correct reference implementation (copy this, don't reinvent)
- **`dish-projection.resolver.ts:216` `displayName()`** — for a catalog-sourced
  item it returns the **live** `catalogName[locale]` (from
  `CatalogResolutionService.resolveMany`), else the local `row.name`, else the id.
  This is exactly the resolve-live behaviour the ticket mandates, already wired,
  already batched (`resolveMany` at `:117`). `CatalogResolutionService` already
  carries the trilingual name: `EffectiveStockItem.catalogName: {hy,ru,en} | null`
  (`catalog-resolution.service.ts:47,110`).

### Display consumers that read `name` directly and must change
| # | Consumer | Anchor | Reads | Has `catalogItemId` path? |
|---|----------|--------|-------|---------------------------|
| a | **`InventoryItemResponse`** (list, detail, create, adopt, update, set-consumption-location — all six item routes) | `responses.ts:20,54`; controller `inventory-items.controller.ts:79,96,123,148,174,215` | flat `name: string` off the domain entity | **No** today — DTO is built from the `InventoryItem` entity only, which has no resolution. This is the **primary** surface. |
| b | **Stock-on-hand list** `StockRowResponse` | `responses.ts:227,240`; reader `prisma-inventory-stock.reader.ts:86` (`name: i.name`) | flat `name` selected straight from the row | No — raw prisma select, no catalog join/resolve. |
| c | **Inventory reports reader** (valuation / movement-history rollups) | `prisma-inventory-report.reader.ts:117,175` (`itemName: item.name`) | flat `itemName` | No. |
| d | **Recipe detail — counterpart lists** (processed-output ⇄ raw-source names) | `recipe-detail.assembler.ts:63,70` (`name: i.name`) | flat `name` off the item entity; **locale is in scope** (`assemble(recipe, locale)` `:43`) but unused for these two lines | Partially — assembler already uses the dish resolver for ingredients, but these two counterpart maps bypass it. |

### Write / round-trip paths (must tolerate `name: null`)
- Entity: `inventory-item.ts` — `name: string` in props/create input (`:11,37`),
  getter `:102`, `create()` `:65`, `updateDetails()` `:199`.
- Mapper: `inventory.mappers.ts` — `toDomain` `:44`, `toCreate` `:66`, `toUpdate` `:88`
  all pass `name` through as a plain string.
- Adopt use-case seeding: `adopt-catalog-item.usecase.ts:99` `const name = input.name ?? catalogItem.name.hy;` — **this is the line the ticket removes.**
- Create use-case: `create-inventory-item.usecase.ts:72` passes `input.name` (required — keep).
- Update use-case: `update-inventory-item.usecase.ts:73` forwards `name` unconditionally (needs the platform-owned guard).
- Resolution reader select still needs `name` for the custom-item fallback: `prisma-item-resolution.reader.ts:44,51`.

### Key / filter consumers (NOT display, but assume `name` is non-null)
- **Search filter** `name: { contains: search }` — `prisma-inventory-item.repository.ts:22` and `prisma-inventory-stock.reader.ts:29`. A null-named adopted item will **never match a name search** → adopted items become unsearchable by their (catalog) name. Flag — see §6.
- **List ordering** `orderBy: { name: 'asc' }` — `prisma-inventory-item.repository.ts:29`, `prisma-inventory-stock.reader.ts:34`. Postgres sorts NULLs last on ASC; no crash, but adopted items clump at the bottom. See §4.
- **CSV export key** `inventoryItemKey()` `catalog-key.util.ts:45` → `slug(rec.name)` when `sku` is null. With `name=null` **and** `sku=null` this throws. Caller `catalog-export.service.ts:117`. Out of ticket scope (export) but a real null-hazard — flag, don't fix here.

### Confirmed NON-consumers (no change needed)
- **KDS ticket** reads `nameSnapshot` off the order item, not `InventoryItem.name` (`prisma-station-tickets.reader.ts:69,100`). Inventory items never appear on a KDS ticket.
- **Fiscalization / receipt** — no reference to `InventoryItem`/inventory name anywhere in `fiscalization/` (grep clean). Receipts render sold-product snapshots, not ingredients.
- **order-item-allergen.resolver** — uses `resolveMany` for allergens only; no name surface.

---

## 2. Locale handling for reads — the actual convention

**Explicit `?locale=` query param, coerced, defaulting to `en`. Not `Accept-Language`.**

- The only localized read path today (the dish/customer projection) takes locale as
  a query param: `recipes.controller.ts:74,80,86` → `@Query('locale') locale?: string`
  → `toLocale(locale)`.
- `toLocale()` (`dish-projection.resolver.ts:21`) whitelists `hy|ru|en`, **defaults to `en`**.
- No `Accept-Language` header parsing exists anywhere in `src` (grep clean).
- The catalog **browse** response returns the trilingual `name:{hy,ru,en}` object and
  lets the client pick — per the ticket's established context.

So there are two existing conventions in the codebase: **(i)** trilingual-object +
client picks (catalog browse), and **(ii)** server picks via `?locale` param (dish
projection). Both are live.

---

## 3. Server-side render paths needing a single concrete string

**There are none for inventory item names.** The only server-render surfaces that
emit a locale-less string (KDS ticket, fiscal receipt) read **snapshots of sold
product names**, not `InventoryItem.name` (see §1 non-consumers). Every remaining
consumer of `InventoryItem.name` returns JSON to a client that can pick a locale.

Therefore the "resolve to a concrete string via branch default locale" branch of the
ticket (§2.4 last bullet) is **not needed** — no path requires it.

**Branch default-locale setting: does not exist.** Grep for
`defaultLocale`/`branch…locale` is clean. If a concrete-string path is ever added,
the `hy → en → ru` fallback is the only option and would need a `// NOTE:` for a real
setting. `UNCONFIRMED` → **confirmed absent, and confirmed not required for this ticket.**

---

## 4. Migration safety for `name` → nullable

**Clean.** No blockers.
- **No unique or index on `InventoryItem.name`.** The item model's only unique is
  `@@unique([restaurantId, branchId, sku])` (`schema.prisma:1378`); indexes are on
  restaurant/branch/category/catalogItemId (`:1379-1383`). The
  `@@unique([restaurantId, branchId, name])` at `schema.prisma:715` belongs to
  **`RestaurantTable`**, not inventory — irrelevant here.
- **No raw SQL** against `inventory_items` (grep for `queryRaw`/`executeRaw` in the
  inventory module is clean).
- **`orderBy: { name: 'asc' }`** (two sites, §1) — Postgres default is NULLs-last on
  ASC, so no error; adopted items just sort last until they get a resolved-name sort.
- **`name: { contains }`** search (two sites) — null simply doesn't match; no error,
  but a real UX gap (§6).
- Existing rows keep their `name`; no backfill. The proposed app+DB invariant
  `name IS NOT NULL OR catalog_item_id IS NOT NULL` holds for all current rows
  (every current row has a name).

---

## 5. Adopt seeding + create validation — confirmed

- **Adopt seeds the name** at `adopt-catalog-item.usecase.ts:99`
  (`input.name ?? catalogItem.name.hy`), plus the DTO's optional override
  `AdoptCatalogItemDto.name` at `item.dto.ts:96-102`, and the controller forwards it
  `inventory-items.controller.ts:143`. **All three come out** in Step 2.
- **Create requires name**: DTO `@IsString() @MinLength(1) name!` (`item.dto.ts:32-36`);
  use-case input `name: string` (`create-inventory-item.usecase.ts:24`). **Keep.**
- **Update currently lets name through unconditionally**
  (`update-inventory-item.usecase.ts:73`, DTO `item.dto.ts:115-120`) — no
  platform-owned guard yet. This is where `INVENTORY_ITEM_NAME_PLATFORM_OWNED` goes.

---

## RECOMMENDATION (the `// NOTE:` the ticket asks for)

**(a) Return trilingual `catalogName` + nullable `name`; let clients pick. Preferred.**
It matches the catalog **browse** contract, needs **zero** backend i18n, and the dish
resolver already proves the batched `resolveMany` path works with no N+1. Concretely
for the primary DTO: `InventoryItemResponse.name: string | null` (local; null when
adopted) **plus** `catalogName: {hy,ru,en} | null` (live-resolved; present when
adopted). Client display = `catalogName ? catalogName[locale] : name`.

**(b) The "concrete string via branch default locale" path is unnecessary** — §3
shows no locale-less server-render path reads inventory item names. Recommend
**dropping that sub-task** for this ticket rather than building an unused resolver
branch. (If you'd rather keep parity with the ticket text, the fallback would be
`hy → en → ru` with a `// NOTE:` for a future branch-locale setting — but it wires to
nothing today.)

**Blast radius for Step 2 (display side):** one shared batch resolver in the inventory
read layer, consumed by **four** surfaces — `InventoryItemResponse` (a), stock-on-hand
`StockRowResponse` (b), reports reader (c), recipe-detail counterparts (d) — where (d)
can largely reuse the resolver the assembler already calls. Write side: entity + mapper
+ create/adopt/update use-cases + schema nullable. Reference `displayName()` already
exists — the work is generalizing it out of the dish resolver, not inventing it.

**Two out-of-band null hazards to decide on (not in ticket scope, flagged not fixed):**
`inventoryItemKey()` `slug(name)` on a null name during CSV export
(`catalog-key.util.ts:45`), and name-search returning nothing for adopted items
(`prisma-inventory-item.repository.ts:22`). Both are real once `name` can be null.

---

*Gate: awaiting go-ahead before Step 2 (schema + resolver + use-case changes). No
feature bundling.*
