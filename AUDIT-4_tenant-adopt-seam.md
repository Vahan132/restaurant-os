# AUDIT-4 — Tenant Adopt Seam (READ-ONLY)

_Inspection only. No repo writes. Evidence anchors are file:line against the tenant `InventoryItem`/inventory side and the platform-catalog resolution/capability code._

---

## Findings

**Q1 — InventoryItem create path.** `CreateInventoryItemUseCase` at `api/src/modules/inventory/application/commands/create-inventory-item.usecase.ts:37` → domain `InventoryItem.create(...)` (L68) → `this.items.create(item)` (L82) via `INVENTORY_ITEM_REPOSITORY`. DTO: `CreateInventoryItemDto` at `application/dto/item.dto.ts:32`. Required to create today:
- `name` — required, `item.dto.ts:33-36` (`@IsString @MinLength(1)`); schema `name String` NOT NULL (`schema.prisma:1346`).
- `baseUnit` — required (this is the unit), `item.dto.ts:38-40` (`@IsEnum(InventoryBaseUnit)`, not optional); schema NOT NULL, no default (`schema.prisma:1350`).
- `restaurantId` / `branchId` — required from scope (not DTO); usecase L22-23, guarded `NoRestaurantInScope()` L49-51; schema NOT NULL (`:1343`, `:1345`).
- `actorUserId` — required from auth context (usecase L32).
- Optional: `kind ItemKind @default(RAW)` (`:1349`), `categoryId String?` (`:1348`), `sku String?` (unique per `@@unique([restaurantId, branchId, sku])` `:1378`). `consumptionLocationId String?` is **not** a create field (defaults to branch Main Storage when null, `:1355-1357`).
- Minimal set: **name + baseUnit** (DTO) + **restaurantId, branchId, actorUserId** (scope/auth).

**Q2 — Name storage.** `InventoryItem` stores its **own single-string `name`** (`schema.prisma:1346`), NOT trilingual. CatalogItem comment confirms the split: "operational InventoryItem.name is single-locale, so the translations must live here" (`schema.prisma:2070-2071`); trilingual `nameHy/Ru/En` live on `CatalogItem` (`:2076-2078`). Display reads the **local** name: `prisma-item-resolution.reader.ts:42` selects `name: true`, maps `name: r.name` (L51) straight from the InventoryItem row. `catalog-resolution.service.ts` resolves only allergens + adgCode by reference — **it does not resolve/override name** (searched — no name resolution). `// NOTE:` so adopt should copy the catalog trilingual name into the local single-string `name` at adopt time (pick a locale / owner-supplied), since display never resolves name from catalog.

**Q3 — Unit source.** `CatalogItem` carries **no** unit/measure/baseUnit field (re-read `schema.prisma:2073-2100`: id, slug, name{Hy/Ru/En}, categoryId, adgCode, status, allergensReviewed, timestamps, relations only). Unit is **InventoryItem-side**: `baseUnit InventoryBaseUnit` NOT NULL (`:1350`) + `alternateUnits Json @default("[]")` (`:1351`). Adopt therefore cannot derive unit from the catalog — it must be supplied.

**Q4 — Tenant-facing catalog read.** None. The only controller returning `CatalogItemResponse` is `platform/catalog-items` under `@UseGuards(PlatformAuthGuard)` (`api/src/modules/platform/presentation/http/platform-catalog-items.controller.ts:30-33`): `GET /` list (L43-56), `GET /:id` (L58-63). Searched all `*.controller.ts` in `api/src` for `CatalogItemResponse`/`ListCatalogItems`/`CatalogItem` — the platform controller is the only match; `modules/catalog/.../catalog.controller.ts` is the menu export/import module (guard `inventory:item:manage`), not a CatalogItem browse. `GetCatalogItemUseCase`/`ListCatalogItemsUseCase` are consumed only by the platform controller. `CatalogResolutionService` is per-item (`resolve`/`resolveMany` keyed by known `catalogItemId`) — the reader "deliberately exposes no way to list … only resolves a catalogItemId forward" (`catalog-item.reader.ts:26-45`), i.e. **no list/search by name**. `// NOTE:` tenants have no browse path — a tenant-facing catalog browse/search read must be built.

**Q5 — Adopt write path + duplicate policy.** Grepped all of `api/src` for `catalogItemId | allergenOverride | adgCodeOverride`: every InventoryItem-side hit is **read-only** (`prisma-item-resolution.reader.ts:43-55`, `dish-projection.resolver.ts:241-243`, `item-resolution.reader.ts:15-19` port types, `catalog-resolution.service.ts` consumes as input). The `catalogItemId` write hits under `platform-catalog/prisma-catalog-item.repository.ts:198,205` are the **CatalogItemAllergen join** (platform side), not InventoryItem. **No InventoryItem create/update sets any of the three fields** (`CreateInventoryItemUseCase`/`InventoryItem.create` don't pass them, usecase L68-81). Duplicate policy: only `@@index([catalogItemId])` (`schema.prisma:1383`); the sole `@@unique` on InventoryItem is `@@unique([restaurantId, branchId, sku])` (`:1378`). **No `@@unique([branchId, catalogItemId])`** → double-adopt is not DB-prevented.

**Q6 — Resolution port reuse.** `CatalogResolutionService` at `api/src/modules/platform-catalog/application/services/catalog-resolution.service.ts:55`. Exported from the module: `platform-catalog.module.ts:45-47` `exports: [CatalogResolutionService, CATALOG_ITEM_READER, ...]` (both service and port token). **Already reused read-only by inventory**: `dish-projection.resolver.ts:3-6,79` injects it and calls `resolveMany(...)` for the CATALOG-3/4 allergen rollup — cross-module precedent exists. Return type `CatalogResolution` (`catalog-item.reader.ts:11-24`) = `{ catalogItemId, allergenSlugs[], adgCode, allergensReviewed, name: {hy,ru,en} }` — carries the **trilingual name** + allergensReviewed + allergens + adgCode. `// NOTE:` there is **no ACTIVE/ARCHIVED status field**; an archived/removed item resolves to `null` (`getResolution` returns null, L34-37). So resolution confirms "adoptable now" and yields the trilingual name, but cannot distinguish archived-vs-nonexistent (UNCONFIRMED whether the reader filters archived in SQL — would need `prisma-catalog-item.reader.ts`). ADR "no ORM path back to tenant inventory" is **not violated**: the service's only dep is `@Inject(CATALOG_ITEM_READER)`, takes tenant values as plain input structs, and never queries `InventoryItem` (module doc: "Touches CatalogItem + taxonomy only — never tenant inventory (ADR §4)", `platform-catalog.module.ts:25-26`).

**Q7 — Capability gate.** Create route `inventory-items.controller.ts:96-97` `@Post() @RequirePermissions(MANAGE)` where `MANAGE = PERMISSIONS.INVENTORY_ITEM_MANAGE` (L40); controller is `@BranchScoped()` (L44). Exact string: `PERMISSIONS.INVENTORY_ITEM_MANAGE = 'inventory:item:manage'` (`api/src/modules/identity/domain/permissions.catalog.ts:31`). `// NOTE:` no `MANAGE_INVENTORY` constant exists (searched — no match); it's `@RequirePermissions`, not `@RequireCapability`. Holder roles (`SYSTEM_ROLE_PERMISSIONS`, `permissions.catalog.ts:140-181`): **OWNER** (all perms, L141) and **MANAGER** (all except ROLE_MANAGE, L143). WAITER/CASHIER/KITCHEN_STAFF/CHEF/SOUS_CHEF/RECEPTIONIST do not hold it (CHEF/SOUS_CHEF get only KDS + INVENTORY_READ + INVENTORY_PROCESS_RUN, L163-172). Custom roles hold it only if `inventory:item:manage` is explicitly assigned.

---

## TENANT ADOPT SEAM

```
- InventoryItem create use-case: CreateInventoryItemUseCase — create-inventory-item.usecase.ts:37 (+ InventoryItem.create L68, DTO item.dto.ts:32)
- required fields to create: name (item.dto.ts:33), baseUnit (item.dto.ts:38) + restaurantId/branchId/actorUserId from scope+auth (usecase L22-23,32); optional kind(RAW)/categoryId/sku
- name storage: local single-string InventoryItem.name (schema.prisma:1346); display reads local name (prisma-item-resolution.reader.ts:51), NOT resolved from catalog
- CatalogItem has unit: NO (schema.prisma:2073-2100 has no unit) → unit is InventoryItem-side (baseUnit, schema.prisma:1350)
- tenant-facing catalog read: NONE — only platform/catalog-items under PlatformAuthGuard (platform-catalog-items.controller.ts:30-56); must build tenant browse
- catalogItemId write path today: confirmed absent — no InventoryItem create/update sets catalogItemId/allergenOverride/adgCodeOverride (grep api/src, all read-only)
- (branchId, catalogItemId) unique: NO, index-only (@@index([catalogItemId]) schema.prisma:1383; only @@unique is [restaurantId,branchId,sku] :1378)
- CatalogResolutionService importable read-only by inventory: YES — exported (platform-catalog.module.ts:45-47), already injected by dish-projection.resolver.ts:79; no InventoryItem access (ADR §4 safe)
- inventory-write capability: inventory:item:manage (PERMISSIONS.INVENTORY_ITEM_MANAGE, permissions.catalog.ts:31) — roles OWNER, MANAGER
```

### ADOPT DESIGN VERDICT
- **adopt = new `AdoptCatalogItemUseCase`** (do not overload create). Rationale: adopt needs inputs the plain create doesn't model (`catalogItemId` + owner-supplied `baseUnit` + optional overrides), must validate the catalog item via `CatalogResolutionService` and seed the local `name` from the resolved trilingual name, and must enforce a double-adopt guard. It can still reuse the `InventoryItem.create` domain factory + `INVENTORY_ITEM_REPOSITORY` write internally, adding `catalogItemId` to the created entity — so it's a thin orchestration layer, not duplicated logic. (Alternatively: extend `CreateInventoryItemDto` with an optional `catalogItemId`, but the extra validation/guard/name-seeding makes a dedicated use-case cleaner.)
- **tenant browse endpoint: must build.** No non-platform route reads CatalogItems, and `CatalogResolutionService` is per-id only (no list/search). Need a tenant-guarded `GET` list/search over ACTIVE CatalogItems (paged, name/slug search, category filter) returning the trilingual name + adgCode + allergens.
- **unit required as adopt input: YES.** CatalogItem carries no unit; `baseUnit` is a NOT-NULL InventoryItem column with no default, so the owner must supply it (and any `alternateUnits`) at adopt.
- **double-adopt guard: code-guard needed.** No `@@unique([branchId, catalogItemId])`; the use-case must check for an existing non-deleted `InventoryItem` with the same `catalogItemId` in-branch and reject (e.g. `CATALOG_ITEM_ALREADY_ADOPTED`). Consider adding the DB unique constraint later for defense-in-depth, but that's a migration out of this read-only scope.

### Two design notes for the spec
- **Archived detection.** `CatalogResolution` exposes no status enum — archived resolves to `null`. Adopt can treat `null` as "not adoptable" (covers both archived and nonexistent), but if support needs a distinct "this item was archived" message, the tenant browse read (which can filter/return `status`) should be the source of that signal, not the resolution port.
- **Gate for adopt.** Reuse `inventory:item:manage` (OWNER/MANAGER) since adopt creates an InventoryItem — no new capability needed unless you want to separate "adopt from catalog" from "create custom item."
```
