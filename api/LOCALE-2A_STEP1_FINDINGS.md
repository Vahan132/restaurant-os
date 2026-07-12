# LOCALE-2A — STEP 1 FINDINGS (inspection only, no code)

Findings-first per the ticket. Anchors are `path:line`. **Result: the plan is clean and
fully additive — no blockers.** Every premise checks out: `name` columns are NOT NULL with
no name-uniqueness, `description` exists only on MenuItem/MenuCategory, the write/read paths
are symmetric across the four entities, `I18nTextResponse {hy,ru,en}` and the `CatalogItem`
flat-column migration are ready-made precedents, and the snapshot/storefront/fiscal readers
touch only the scalar `name`/`description` (or `nameSnapshot`) — so additive nullable
translation columns can't regress them.

---

## 1. Current columns, NOT NULL, and uniqueness (`schema.prisma`)

| Entity | `name` | `description` | Uniqueness touching `name`? |
|---|---|---|---|
| `MenuItem` (`:menu_items`) | `String` **NOT NULL** | `String?` (nullable) | **No** — only `@@unique([restaurantId, branchId, code])` (on `code`) |
| `MenuCategory` (`:menu_categories`) | `String` **NOT NULL** | `String?` (nullable) | **No** — only `@@unique([restaurantId, branchId, code])` |
| `ModifierGroup` (`:modifier_groups`) | `String` **NOT NULL** | **none** | **No** — indexes only, no unique |
| `ModifierOption` (`:modifier_options`) | `String` **NOT NULL** | **none** | **No** — indexes only, no unique |

So the columns to add (all **nullable**, matching §2.1):
- **MenuItem**: `nameHy/nameRu/nameEn`, `descriptionHy/descriptionRu/descriptionEn`.
- **MenuCategory**: `nameHy/nameRu/nameEn`, `descriptionHy/descriptionRu/descriptionEn`.
- **ModifierGroup**: `nameHy/nameRu/nameEn` (no description).
- **ModifierOption**: `nameHy/nameRu/nameEn` (no description).

(The ticket §2.1's `descriptionHy/nameRu/descriptionEn` line is a typo for `descriptionHy/Ru/En`.)
Translations never collide with any uniqueness — the only uniques are on `code`.

## 2. Admin write paths (create + update) — where translations get accepted/persisted

Symmetric per entity: **DTO → use-case → domain entity mutator → mapper `toCreate`/`toUpdate` → prisma**. Anchors:

**MenuItem**
- DTO: `CreateMenuItemDto` (`menu/application/dto/item.dto.ts:17` — `name` required `:21`, `description?` `:34`); `UpdateMenuItemDto` (`:60` — `name?` `:65`, `description?` `:70`).
- Use-cases: `create-menu-item.usecase.ts` (input `:27-28`, `MenuItem.create` `:74-75`); `update-menu-item.usecase.ts` (input `:29-30`, `item.updateDetails({name,description,…})` `:88-90`).
- Entity `menu-item.ts`: props `:16-17`, create input `:44-45`, `create()` `:78-79`, `updateDetails()` sets name `:177` / description `:178`.
- Mapper `menu.mappers.ts` `ItemMapper`: `toCreate` `:94-95`, `toUpdate` `:115-116` (repo `prisma-menu-item.repository.ts:61,67`).

**MenuCategory**
- DTO: `CreateCategoryDto` (`category.dto.ts:20` — `name` `:24`, `description?` `:29`); `UpdateCategoryDto` (`:38` — `name?` `:43`, `description?` `:48`).
- Use-cases: `create-category.usecase.ts` (`:15-16`, `MenuCategory.create` `:42-43`); `update-category.usecase.ts` (`:14-15`, `category.rename(name, description)` `:39`, guarded `:38`).
- Entity `menu-category.ts`: props `:9-10`, create `:43-44`, mutator is **`rename(name, description?)`** `:92-98` (NOT `updateDetails`).
- Mapper `CategoryMapper`: `toCreate` `:41-42`, `toUpdate` `:54-55`.

**ModifierGroup** (name only)
- DTO: `CreateModifierGroupDto` (`modifier.dto.ts:17` — `name` `:21`); `UpdateModifierGroupDto` (`:45` — `name?` `:50`).
- Use-cases: `create-modifier-group.usecase.ts` (`:15`, `ModifierGroup.create` `:41`); `update-modifier-group.usecase.ts` (`:19`, `group.update({name,…})` `:46-47`). (`add-modifier-group.usecase.ts` only ATTACHES an existing group to a dish — not a create path.)
- Entity `modifier-group.ts`: props `:8`, create `:60`, mutator `update()` sets name `:151`.
- Mapper `GroupMapper`: `toCreate` `:154`, `toUpdate` `:168`.

**ModifierOption** (name only)
- DTO: `CreateModifierOptionDto` (`modifier.dto.ts:106` — `name` `:110`); `UpdateModifierOptionDto` (`:132` — `name?` `:137`).
- Use-cases: **create is `add-modifier-option.usecase.ts`** (`:19`, `ModifierOption.create` `:47`); `update-modifier-option.usecase.ts` (`:15`, `option.update({name,…})` `:40-41`).
- Entity `modifier-option.ts`: props `:9`, create `:54`, mutator `update()` sets name `:119`.
- Mapper `OptionMapper`: `toCreate` `:202`, `toUpdate` `:216`.

**Update convention to adopt** (matches the recommended §2.2 and existing code): field **present ⇒ set/clear** (explicit `null` clears), field **absent ⇒ unchanged** — the same `!== undefined` guard already used for name/description in every `updateDetails`/`update`/`rename`. So an entity mutator needs to accept `string | null` for each translation (undefined = leave).

## 3. Admin read responses — where the `{hy,ru,en}` objects get added

All in `menu/application/dto/responses.ts`:
- **Category**: `CategoryResponse` (`:11`, `from` `:21`) — has `name` `:16`, `description` `:17`.
- **MenuItem**: `MenuItemResponse` (`:35`, `from` `:65`) + `MenuItemDetailResponse` (`:203`, extends it) — `name` `:41`, `description` `:42`.
- **ModifierGroup**: `ModifierGroupResponse` (`:110`, `from` `:121`), also surfaced via `ModifierGroupWithOptionsResponse` (`:136`) and `AttachedModifierGroupResponse` (`:186`) which spread `ModifierGroupResponse.from` — add the object once on the base and it flows to all three.
- **ModifierOption**: `ModifierOptionResponse` (`:87`, `from` `:96`).

Add e.g. `nameI18n!: I18nTextResponse` (+ `descriptionI18n` where applicable) built from the entity's translation getters, nulls where empty. Because detail/attached/with-options responses **spread** the base `.from`, they inherit the new object automatically.

## 4. `Restaurant.defaultLanguage` reachability (informational)

Column `Restaurant.defaultLanguage String @default("en")` (`schema.prisma:168`). The menu-authoring context is tenant-scoped (`restaurantId` in scope on every menu controller), so it's reachable — but the **menu module does not currently read the Restaurant row**. It's already exposed elsewhere (`restaurant/application/dto/responses.ts:12`, and the storefront `PublicRestaurantInfo.defaultLanguage`). Per the ticket it's informational only (backend doesn't branch on it for storage); surfacing "which language is primary" to the authoring UI can reuse the existing restaurant-profile response rather than adding a Restaurant read to the menu path. **Recommend: don't add a Restaurant read here** — leave the primary-language hint to the UI's existing restaurant-profile fetch.

## 5. `I18nTextResponse` shape + `CatalogItem` precedent

- **Response shape**: `I18nTextResponse { hy: string|null; ru: string|null; en: string|null }` at `consumer/application/dto/responses.ts:4`. Reuse verbatim for the admin translation objects. (An input `I18nTextDto` exists at `consumer/application/dto/admin-listing.dto.ts:21`, but the ticket wants **flat optional fields** on the write DTOs, not a nested input object — so use flat `nameHy?/nameRu?/nameEn?` etc.)
- **Migration precedent**: `CatalogItem` uses flat **camelCase** columns `nameHy/nameRu/nameEn` (`schema.prisma`), created as `"nameHy" TEXT NOT NULL` (`migrations/20260724000000_catalog_foundation/migration.sql:44-46`). Our columns mirror the naming but are **`TEXT` NULLABLE** (no `NOT NULL`, no `@map` — camelCase column names, consistent with the codebase's unmapped-column convention).

## 6. Storefront / fiscal / order-builder read the scalar `name` — unaffected

Additive nullable columns cannot regress these (they never select translations):
- **Order-item builder** `orders/application/services/order-item-builder.ts`: `nameSnapshot: data.item.name` `:118`, `goodName: data.item.name` `:126`, modifier `nameSnapshot` from `group.name`/option `name` `:88` — all scalar reads.
- **Fiscalization** `orders/application/services/fiscalize-order.service.ts`: reads `OrderItem.nameSnapshot` (`:37-38`) — the frozen order-line snapshot, never live menu translations. The `fiscalization` module itself has no menu-name read.
- **Public storefront** `storefront/infrastructure/prisma-public-storefront.query.ts`: scalar `c.name/c.description` (`:150-151`), `it.name/it.description` (`:154-155`), `g.name` (`:131`), option `name` (`:118`). (Guest-locale emission that would consume translations is LOCALE-2B — out of scope.)

---

## RECOMMENDATION / Step 2 shape (for your go-ahead)

Purely additive, ~4 files-per-entity, no backfill:
1. **Schema + migration**: 18 nullable `TEXT` columns (MenuItem 6, MenuCategory 6, ModifierGroup 3, ModifierOption 3), camelCase, no `NOT NULL`, no defaults. One migration, no data changes.
2. **Domain**: add the 3 (or 6) translation fields to each entity's props/create-input/getters and its mutator (`updateDetails`/`rename`/`update`), each accepting `string | null` with the `!== undefined` = leave-unchanged convention.
3. **DTOs**: flat optional `nameHy?/nameRu?/nameEn?` (+ description variants) on the 4 create + 4 update DTOs, `@IsOptional() @IsString()`, `name` (primary) stays required on create. Annotate to avoid the nullable-optional orval smell.
4. **Mappers**: pass the new columns through `toDomain`/`toCreate`/`toUpdate`.
5. **Responses**: add `nameI18n: I18nTextResponse` (+ `descriptionI18n` for MenuItem/MenuCategory) to the 4 base responses (detail/attached/with-options inherit via spread).
6. **Tests + OpenAPI regen** (run on your machine — sandbox has no prisma binary).

Explicit interim `// NOTE:` (per §2.3): dish/category/modifier display stays single-locale until LOCALE-2B resolves `column(locale) ?? name`; storefront/fiscal/order paths untouched.

**Gate:** awaiting go-ahead before Step 2. No code written yet. No feature bundling.
