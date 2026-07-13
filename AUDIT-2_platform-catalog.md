# AUDIT-2 — Platform-Admin Catalog Scope (READ-ONLY)

_Inspection only. No repo writes. Scope limited to `api/src/modules/platform-catalog/**`, the `platform/**` controllers that expose it, the admin `(platform)/platform/catalog` UI, and the tenant→catalog reference seam._

---

## Section 1 — Backend domain & data model

1. **Prisma models owned by platform-catalog** (all in `api/prisma/schema.prisma`, `@@map` to `catalog_*` tables):
   - `CatalogItem` (L2073) — curated stock-item template. `id`, `slug @unique`, trilingual `nameHy/nameRu/nameEn` (L2076-78), `categoryId?`, `adgCode? @map("adg_code")` (L2083), `status CatalogItemStatus @default(ACTIVE)` (L2086), `allergensReviewed Boolean @default(false)` (L2089). Relations: `category`, `allergens CatalogItemAllergen[]`.
   - `CatalogCategory` (L2045) — taxonomy. `slug @unique`, trilingual `labelHy/Ru/En`, `position Int @default(0)`. Not tenant-scoped.
   - `Allergen` (L2027) — fixed seeded EU-14 reference set, "Not tenant-editable" (L2026). `slug @unique`, trilingual `labelHy/Ru/En`, `position`.
   - `CatalogItemAllergen` (L2105) — M2M join CatalogItem↔Allergen, composite PK, `onDelete: Cascade` both sides.
   - `enum CatalogItemStatus { ACTIVE, ARCHIVED }` (L2064) — archived items still resolve so tenant refs never orphan (comment L2061-63).
   - Status/verification: `status` (ACTIVE/ARCHIVED) + `allergensReviewed` (L2089). Comment L2088: `verified = catalogSourced && allergensReviewed`.
2. **Stock vs produced:** catalog models a **stock-item template only** (`CatalogItem` = "curated stock-item template"). Searched the module + schema catalog models — **no recipe/process-graph/produced-item representation here.** Recipes/dishes live in the tenant menu/inventory domain, out of catalog scope. Catalog is leaf stock items.
3. **Allergens:** per-item via `CatalogItemAllergen` join (L2105); authoritative unless tenant sets `InventoryItem.allergenOverride`. Carries `allergensReviewed` on the parent `CatalogItem` (a support-tagging gate, item-level not per-allergen).
4. **adgCode:** present on catalog records — `CatalogItem.adgCode` (L2083) is the platform default classifier; tenant override is `InventoryItem.adgCodeOverride` (L1376); dish/MenuItem `adgCode` (L575) snapshots to `OrderItem.adgCode` (L920). `// NOTE:` schema comment L2081-82 says wiring the catalog effective value into `OrderItem.adgCode` for stock-sourced dishes is "a later prompt" — UNCONFIRMED / not yet wired.

`// NOTE:` **CatalogItem = { slug, name{Hy,Ru,En}, categoryId?, adgCode?, status(ACTIVE|ARCHIVED), allergensReviewed, allergens[] via join }** — a platform-owned, trilingual, soft-deletable stock-item template whose allergens + adgCode are authoritative defaults tenants override by reference.

---

## Section 2 — Backend use-cases & endpoints

`// NOTE:` the platform-catalog module exposes **no controllers itself** (`platform-catalog.module.ts` has providers/exports only). The HTTP surface lives in **PlatformModule**, guarded by `PlatformAuthGuard` (platform-admin token; **no per-capability guards**).

1. **Routes** (all `@Public()` + `@UseGuards(PlatformAuthGuard)`):
   - `platform-catalog-items.controller.ts` @ `platform/catalog-items` — **READ:** `GET /` list (L37, paged/search/filter), `GET /:id` (L52). **WRITE:** `POST /` create (L59), `PATCH /:id` update (L76), `POST /:id/archive` (L96).
   - `platform-catalog-taxonomy.controller.ts` @ `platform/catalog-taxonomy` — **READ:** `GET /` (L24, allergens + categories picker).
   - Total: **3 read routes / 3 write routes.**
2. **Use-cases** (`platform-catalog/application/`): `CreateCatalogItemUseCase` (create + slug-uniqueness + allergen/category validation, cuid2 id), `UpdateCatalogItemUseCase` (patch mutable fields), `ArchiveCatalogItemUseCase` (soft-delete), `GetCatalogItemUseCase` (fetch one), `ListCatalogItemsUseCase` (paginated, active-only default, `reviewed` queue filter), `GetCatalogTaxonomyUseCase` (allergen+category reference), `CatalogResolutionService` (effective allergen/adgCode resolution — the tenant READ path, exported to other modules).
3. **CRUD (CatalogItem):** create **PRESENT** (`create-catalog-item.usecase.ts`), read **PRESENT** (`get-catalog-item.usecase.ts`), list **PRESENT** (`list-catalog-items.usecase.ts`), update **PRESENT** (`update-catalog-item.usecase.ts`), delete **MISSING by design** — archive only (`POST /:id/archive`); no `@Delete` route. **Categories/taxonomy CRUD: MISSING** — `GET /catalog-taxonomy` is read-only; no create/update/delete for `CatalogCategory`/`Allergen` (seed-managed; Allergen "Not tenant-editable" L2026).
4. **Bulk ops: MISSING** — searched the module, no import/export/batch-upsert/dedupe. (The separate `modules/catalog/.../catalog-import.service.ts` is the distinct tenant menu import/export module, explicitly out of scope per `platform-catalog.module.ts` L25.)
5. **DTO hygiene: clean** (`application/dto/catalog-item.dto.ts`). Write DTOs whitelist fields with class-validator; nullables `categoryId`/`adgCode` use `@IsOptional() + @ValidateIf(v!==null) + @IsString()` (L26-36) rather than bare nullable; `allergenSlugs` `@IsArray()+@IsString({each:true})`; list query coerces `includeArchived` via `@Transform`, constrains `reviewed` with `@IsIn`. `// NOTE:` despite clean DTOs, orval still emits `categoryId`/`adgCode` as `{[key:string]:unknown}|null` in the admin client (nullable-optional mistype) — the UI coerces at the boundary (see Section 4).

---

## Section 3 — Tenant consumption seam

1. **Reference field:** `InventoryItem.catalogItemId String?` (schema L1374), with sibling overrides `allergenOverride Json?` (L1375) and `adgCodeOverride String?` (L1376), indexed `@@index([catalogItemId])`. `// NOTE:` it is a **plain scalar — NO FK, no Prisma relation** (comment L1364-69: enforces ADR §4, "the platform catalog editor has NO ORM path back to tenant inventory").
2. **Model = reference-with-override, NOT clone.** Schema L1370-73: "Allergens/adgCode resolve BY REFERENCE (ADR §3): override → catalog (via catalogItemId) → null; the catalog stays the authority — NO denormalized copy is stored here." Confirmed in `catalog-resolution.service.ts` L61-67 (reads live catalog via `catalog.getResolution(catalogItemId)`, precedence override→catalog→none at L96-111). No copy/clone/snapshot on adopt.
3. **Adopt path — ABSENT.** Searched `api/src` for `adopt`, `fromCatalog`, `importFromCatalog`, `link.*catalog` — zero. `catalogItemId` appears in only 4 places in inventory, **all read-only** (`prisma-item-resolution.reader.ts` L43,53; `dish-projection.resolver.ts` L241; `item-resolution.reader.ts` L15). **No command/DTO/repository ever WRITES `catalogItemId`, `allergenOverride`, or `adgCodeOverride`.**

`// NOTE:` **Tenant→catalog seam is PARTIAL.** The reference contract + read/resolution path (reference-with-override) are fully built; the **write/adopt path is absent** — no use-case or endpoint lets a tenant set `catalogItemId` or the override columns. Tenants can be resolved against a catalog reference, but cannot yet adopt an item or set overrides.

---

## Section 4 — Admin UI capabilities `(platform)/platform/catalog`

1. **Screens:** exactly **one** route — `admin/src/app/(platform)/platform/catalog/page.tsx:5-12` → `PlatformCatalogPage` → `PlatformAuthGuard > PlatformShell > CatalogManager`. No `[id]`, `new`, or import/export sub-routes. Two components: `CatalogManager` (list+filters+table) and `CatalogItemForm` (create/edit drawer), both under `admin/src/components/platform-catalog/`; shared hook layer `admin/src/lib/platform-catalog/use-catalog.ts`. `// NOTE:` bulk import/export/clone is a **separate** feature at `(app)/catalog-tools` (branch-scoped, `useCatalogController Export/Import/Clone`), NOT part of platform-catalog.
2. **Wiring / stub scan:** every action wired to a real orval hook; stub-keyword scan of `components/platform-catalog/` found **no** TODO/coming-soon/not-implemented/FIXME — only benign `placeholder=` attrs and `disabled={submitting}` guards.
3. **Capability matrix:**
   - list — **WORKS** (`catalog-manager.tsx:61` `usePlatformCatalogItemsControllerList`)
   - view — **PARTIAL** — no dedicated view; row click opens edit drawer prefilled from list data. `usePlatformCatalogItemsControllerGet` exists but is **unused** (`catalog-manager.tsx:181`).
   - create — **WORKS** (`catalog-item-form.tsx:54,112` `usePlatformCatalogItemsControllerCreate`)
   - edit — **WORKS** (`catalog-item-form.tsx:55,99` `usePlatformCatalogItemsControllerUpdate`)
   - delete — **PARTIAL** — soft-delete/archive only (`catalog-manager.tsx:68,92` `usePlatformCatalogItemsControllerArchive`); no hard delete.
   - allergen editing — **WORKS** — per-item slug toggles via `allergenSlugs` + `allergensReviewed` gate (`catalog-item-form.tsx:46,96,109,215-219`)
   - trilingual — **WORKS** — three inputs `nameHy/nameRu/nameEn` (`catalog-item-form.tsx:149-157`)
   - taxonomy — **MISSING** — read-only `usePlatformCatalogTaxonomyControllerGet` populates dropdowns; no create/update/reorder (`use-catalog.ts:74-76`)
   - bulk import/export — **MISSING** in this route (lives at `(app)/catalog-tools`)
4. **Generated hooks present & current:** yes. `admin/src/api/generated/platform-catalog-items/platform-catalog-items.ts` has List (L89), Create (L187), Get (L244, unused), Update (L343), Archive (L404); `platform-catalog-taxonomy/…` has only `Get` (L81, read-only). All UI imports resolve, no dangling imports. `// NOTE:` nullable `categoryId`/`adgCode` mistyped by orval as `{[key:string]:unknown}|null`, coerced at the boundary (`use-catalog.ts:46-47`, `catalog-item-form.tsx:85-87`) — independently confirmed against the backend DTO smell.

---

## PLATFORM-CATALOG STATUS

### Data model
- records: CatalogItem (trilingual stock-item template: slug, name{Hy/Ru/En}, categoryId?, adgCode?, status, allergensReviewed, allergens[]) + CatalogCategory + seeded Allergen + CatalogItemAllergen join
- stock vs produced: stock-item template ONLY — no produced-item/recipe/process-graph in catalog
- allergens: present (per-item join, item-level `allergensReviewed` semantics)
- adgCode/HS: present on `CatalogItem.adgCode`; tenant override `InventoryItem.adgCodeOverride`; catalog→`OrderItem.adgCode` wiring for stock-sourced dishes NOT yet done (schema comment L2081-82)

### Backend
- routes: 3 read / 3 write (all under PlatformModule, `PlatformAuthGuard` only — no per-capability guards)
- CRUD: create **P** · list **P** · read **P** · update **P** · delete **M** (archive-only by design)
- taxonomy/categories CRUD: **M** (read-only picker; seed-managed)
- bulk import/export: **M**
- DTO hygiene: clean (class-validator, proper nullable handling); but orval mistypes `categoryId`/`adgCode` nullable-optional in the admin client

### Tenant consumption seam
- model: reference-override (`InventoryItem.catalogItemId` scalar, no FK; override→catalog→null resolution)
- adopt use-case: **absent**
- wired to tenant UI: **no** — no write path sets `catalogItemId`/`allergenOverride`/`adgCodeOverride`; resolution is read-only

### Admin UI
- screens present: one — `(platform)/platform/catalog/page.tsx` (CatalogManager list + CatalogItemForm drawer)
- list **W** · create **W** · edit **W** · delete **P** (archive-only) · allergens **W** · trilingual **W** · taxonomy **M** · bulk **M**
- generated hooks present in admin: **yes** (items List/Create/Get/Update/Archive; taxonomy Get only)

### The real gap (what's missing to call this "done")
1. **Tenant adopt/consumption path (highest priority)** — no use-case or endpoint writes `InventoryItem.catalogItemId`/`allergenOverride`/`adgCodeOverride`; the whole reference-override machinery is read-only. Tenants cannot adopt a catalog item or set overrides. Searched `api/src` — no adopt/fromCatalog/link write path.
2. **No tenant-facing catalog browse/adopt UI** — the catalog is platform-admin-only; nothing on the restaurant/admin side lets an owner pick from the catalog.
3. **adgCode not wired into orders for stock-sourced dishes** — catalog effective adgCode → `OrderItem.adgCode` deferred (schema L2081-82), so fiscalization can't yet use catalog classifiers for stock-item dishes.
4. **Taxonomy is read-only** — no create/update/reorder for `CatalogCategory` (and Allergen is intentionally fixed); category management requires a seed change today.
5. **No bulk import/export/dedupe** in platform-catalog — every item is hand-entered one at a time; no batch onboarding path.
6. **Hard delete absent** (archive-only) — acceptable by design, but note no purge path exists.
7. **Coarse authorization** — routes gated only by `PlatformAuthGuard` (any platform-admin token), no per-capability/role separation for catalog writes.
8. **Orval nullable mistype** on `categoryId`/`adgCode` — currently coerced in the UI; a codegen/DTO annotation fix would remove the boundary hack.
