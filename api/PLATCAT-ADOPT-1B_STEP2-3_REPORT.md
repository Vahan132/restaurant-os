# PLATCAT-ADOPT-1B — STEP 2/3 REPORT (implementation)

Implements the approved plan: nullable `name`, adopt persists no name, live catalog-name
resolution centralized in one resolver, `catalogName` returned alongside a nullable local
`name` (clients pick per locale — matching the browse contract). The unused
"branch-default-locale concrete-string" path was **dropped** (Step 1 §3 showed no
locale-less server-render path reads inventory item names).

> ⚠️ **Run on your machine (cannot run on this sandbox — no prisma binary / stale mount):**
> `prisma migrate dev` (or `prisma generate` + apply the new migration) → `tsc --noEmit`
> → `jest` → openapi regen. The type changes below assume the Prisma client is regenerated
> so `InventoryItem.name` is `string | null`.

---

## Schema + migration

- `prisma/schema.prisma`: `InventoryItem.name` is now `String?` (was `String`).
- New migration `prisma/migrations/20260731000000_platcat_adopt_1b_nullable_item_name/migration.sql`:
  drops NOT NULL and adds `CHECK ("name" IS NOT NULL OR "catalogItemId" IS NOT NULL)`
  (note: the column is `"catalogItemId"` — camelCase, unmapped — not snake_case)
  (`inventory_items_name_or_catalog_ck`). No backfill — every existing row has a name,
  so both the relaxation and the CHECK hold for all current data. No index/unique touches
  `name` (verified in Step 1 §4).

## The core resolver (single source of truth)

- **New** `application/services/inventory-item-name.resolver.ts` — `InventoryItemNameResolver`.
  Given `{id, catalogItemId}[]` it returns `Map<id, {hy,ru,en} | null>` using
  `CatalogResolutionService.resolveMany` (already exported from `platform-catalog`).
  Batched (no N+1); **zero** catalog I/O when every item is custom. This is the only
  place the `if catalogItemId` branch lives. Registered in `inventory.module.ts` providers.

## Write side

- `domain/entities/inventory-item.ts`: `name` is `string | null` in props, create-input, and the getter.
- `application/commands/adopt-catalog-item.usecase.ts`: **removed** the `name` input and the
  `name = input.name ?? catalogItem.name.hy` seeding; adopted items are created with `name: null`.
- `application/dto/item.dto.ts`: **removed** `AdoptCatalogItemDto.name`.
- `presentation/http/inventory-items.controller.ts` (adopt route): stopped forwarding `name`.
- `application/commands/update-inventory-item.usecase.ts`: new guard — if `input.name` is
  provided on an item with a `catalogItemId`, throw `INVENTORY_ITEM_NAME_PLATFORM_OWNED`.
  Custom items still edit `name` freely.
- `application/application.errors.ts`: new `InventoryItemNamePlatformOwned()` (409,
  code `INVENTORY_ITEM_NAME_PLATFORM_OWNED`).
- Create use-case unchanged — `name` stays required for custom items.
- `inventory.mappers.ts`: unchanged in code; `name` now flows as `string | null` on both sides.

## Read side — consumers now exposing `catalogName` (name-display surfaces)

Each returns local `name` (nullable) **and** live `catalogName: {hy,ru,en} | null`:

| Surface | Files touched |
|---|---|
| **Item list/detail/CRUD** (`InventoryItemResponse`, all 6 item routes) | `dto/responses.ts` (nullable `name` + new `catalogName`, new `CatalogNameView`, `from(i, catalogName)`); `inventory-items.controller.ts` (inject resolver; batched on list, `toResponse()` helper on the five single-item routes) |
| **Stock-on-hand list** (`StockRowResponse`) | `ports/inventory-stock.reader.ts` (`StockRow.name` nullable + `catalogItemId` + `catalogName`); `prisma-inventory-stock.reader.ts` (select `catalogItemId`); `get-stock.usecase.ts` (resolve, batched); `dto/responses.ts` |
| **6D reports** — stock-on-hand / low-stock / negative-stock (`StockOnHandRowResponse`) | `ports/inventory-report.reader.ts` (`itemName` nullable + `catalogItemId` + `catalogName`); `prisma-inventory-report.reader.ts` (select `catalogItemId`, null-safe sort); `stock-reports.usecase.ts` (`attachCatalogNames` in the 3 name-bearing use-cases); `dto/report-responses.ts` |
| **Recipe warnings — counterparts** | `services/recipe-detail.assembler.ts` (resolve counterpart catalog names, pick active locale); `dto/recipe-responses.ts` (`RecipeWarningCounterpart.name` nullable) |
| **Related items** (`RelatedItemsResponse`) | `dto/process-responses.ts` (`from` takes a name map; **fixed a latent bug** — `.map(InventoryItemResponse.from)` was passing the array index as the 2nd arg); `related-items.controller.ts` (inject resolver, batched) |
| **Dish/customer projection** | already correct pre-ticket (`dish-projection.resolver.ts` `displayName`); made null-safe via `ItemResolutionRow.name: string \| null` |

## Response-shape delta (for openapi regen)

- `InventoryItemResponse`: `name` now **nullable**; **new** `catalogName: {hy,ru,en} | null`.
- `StockRowResponse`: `name` nullable; **new** `catalogName`.
- `StockOnHandRowResponse`: `itemName` nullable; **new** `catalogName`.
- `RecipeWarningCounterpart.name`: nullable.
- `AdoptCatalogItemDto`: **`name` removed**.

## Type-safety fixes outside the display path (so the build stays green)

`InventoryItem.name` becoming `string | null` ripples to every reader of the column:
- `ports/item-resolution.reader.ts`: `ItemResolutionRow.name` → `string | null` (dish resolver already falls back null-safe).
- Out-of-scope **catalog bundle** export/import (flagged, not redesigned): `catalog-key.util.ts`
  `inventoryItemKey` accepts nullable name; `catalog-export.service.ts` and
  `catalog-import.service.ts` coerce `name ?? ''`. `// NOTE:` left that adopted (null-name)
  items need a catalog-reference representation in the bundle — that module's own ticket.
- Edge sync (`edge-registry`, `edge-sync`): no change needed — rows flow through
  `as unknown as` casts; the Prisma `UncheckedCreateInput` name is now nullable.

## Tests (run with `jest` on your machine)

- `adopt-catalog-item.usecase.spec.ts`: rewritten — adopted item now asserts `name === null`;
  removed the name-seed / name-override cases.
- **New** `inventory-item-name.resolver.spec.ts`: adopted → live `{hy,ru,en}`; **propagation**
  (a catalog name edit changes the resolved name for an already-adopted id); custom → null;
  **no-N+1** (one catalog call for many items).
- **New** `update-inventory-item.usecase.spec.ts`: rejects name change on an adopted item
  (`INVENTORY_ITEM_NAME_PLATFORM_OWNED`); allows other edits; custom item edits name freely.

## Location on-hand + low-stock alerts — now wired (follow-up done)

Both operational readers now follow the same pattern (reader selects `catalogItemId` →
use-case batch-resolves via `InventoryItemNameResolver` → response carries
`catalogName {hy,ru,en} | null` with a nullable local name):
- **Per-location on-hand** (`OnHandRowResponse`): `ports/stock-on-hand.reader.ts`
  (`itemName` nullable + `catalogItemId` + `catalogName`), `prisma-stock-on-hand.reader.ts`
  (select `catalogItemId`, `itemName = name ?? null`), `get-location-on-hand.usecase.ts`
  (resolve), `dto/location-responses.ts`. Note: `StockOnHandReader.byItem` is also used by
  `negative-stock-policy.service.ts` (quantities only — unaffected by the nullable name).
- **Low-stock alerts** (`LowStockAlertResponse`): `ports/low-stock-alert.reader.ts`,
  `prisma-low-stock-alert.reader.ts` (item map now id→row for `catalogItemId`),
  `list-low-stock-alerts.usecase.ts` (resolve), `dto/location-responses.ts`.

Response-shape delta (openapi regen): `OnHandRowResponse` and `LowStockAlertResponse` —
`itemName` now nullable, **new** `catalogName`.

## Also flagged, unchanged (real once `name` can be null)

- Name **search** (`prisma-inventory-item.repository.ts:22`, `prisma-inventory-stock.reader.ts:29`)
  won't match adopted items by their catalog name; `orderBy name` sorts adopted (null) rows last.
  Both are follow-ups (search-by-catalog-name is its own change).
