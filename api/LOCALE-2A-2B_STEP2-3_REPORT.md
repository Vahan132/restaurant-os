# LOCALE-2A + LOCALE-2B — STEP 2/3 REPORT (implementation)

Implemented in sequence: **2A** adds trilingual *storage + admin authoring* (write + read)
for the four menu entities; **2B** makes the public storefront *emit* the guest's language
by resolving `translation(locale) ?? primary` in `menuTree`, consuming the effective locale
already threaded by LOCALE-1. Additive only — no fiscal/order change, no authoring UI, and
guests still receive a single resolved string (never `{hy,ru,en}`).

> ⚠️ **Run on your machine** (sandbox has no prisma binary): `prisma migrate dev` (applies
> both the 2A migration) → `tsc --noEmit` → `jest` → OpenAPI regen. Type checks assume the
> Prisma client is regenerated so the new columns exist.

---

## LOCALE-2A — storage + authoring

### Schema + migration (additive, no backfill)
- `schema.prisma`: nullable `nameHy/nameRu/nameEn` on all four entities; plus
  `descriptionHy/descriptionRu/descriptionEn` on `MenuItem` and `MenuCategory` only.
  Primary `name`/`description` unchanged (required). Camel-case columns (unmapped),
  matching the `CatalogItem.nameHy/Ru/En` precedent.
- Migration `20260801000000_locale2a_trilingual_menu_content` — 18 `ADD COLUMN ... TEXT`
  (nullable). No backfill: existing rows keep null translations and render the primary.

### Domain
- New `shared/i18n/i18n-text.ts` — `I18nText { hy, ru, en: string | null }` (neutral, so the
  domain doesn't import a DTO).
- Each entity (`menu-item`, `menu-category`, `modifier-group`, `modifier-option`) gained the
  flat translation props + optional create-input fields, a grouped getter (`nameI18n`, and
  `descriptionI18n` for item/category), and translation handling in its mutator
  (`updateDetails` / `update`; `MenuCategory.rename` took an optional 3rd `MenuI18nInput`).
  Convention everywhere: **field present (incl. explicit `null`) sets/clears; absent leaves
  unchanged**.
- `menu.mappers.ts` — `toDomain`/`toCreate`/`toUpdate` thread the columns for all four.

### Admin write (create + update)
- New `menu/application/dto/i18n.dto.ts` — reusable `NameI18nDto` and
  `NameDescriptionI18nDto` (optional, `@ValidateIf(!== null) @IsString()` so a client can
  clear with `null`), plus `pickNameI18n` / `pickNameDescriptionI18n` extractors.
- The 8 create/update DTOs now **extend** those bases (established inheritance pattern; `name`
  primary stays required on create).
- The 8 use-cases gained the translation input fields and forward them to the entity.
- Controllers (`items`, `categories`, `modifier-groups`) spread `...pickName[Description]I18n(dto)`
  into the use-case calls. (`modifiers.controller` has no write routes.)

### Admin read
- `menu/application/dto/responses.ts` — `CategoryResponse` and `MenuItemResponse` expose
  `nameI18n` + `descriptionI18n`; `ModifierGroupResponse` and `ModifierOptionResponse` expose
  `nameI18n`, all typed as the reused **`I18nTextResponse`** (from the consumer module, per the
  ticket). Detail / with-options / attached responses inherit via their existing spreads.

## LOCALE-2B — storefront emission

- `shared/i18n/locale.ts` — new `resolveI18n(locale, i18n, primary)` = `i18n[locale] ?? primary`,
  generic so a non-null primary returns a non-null string and a null description primary can
  stay null.
- `prisma-public-storefront.query.ts` `menuTree(restaurantId, branchId, locale)` — the `_locale`
  no-op is gone; each field now resolves for the guest: category name+description, item
  name+description, group name, option name. The existing `findMany`s already select all
  columns (no `select` clause), so the translation columns were pulled with no query change.
- Response shape **unchanged** — still single `string`/`string | null`, now resolved. Clients
  need no change.

## Response-shape / API delta (for OpenAPI regen)
- **2A** admin responses gain `nameI18n` (+ `descriptionI18n` on item/category) as
  `I18nTextResponse`; the 8 create/update DTOs gain optional `nameHy?/Ru?/En?` (+ description
  variants on item/category).
- **2B** public menu response shape is **unchanged** (still single strings). The only public
  delta remains LOCALE-1's optional `X-Locale` header.

## Not touched (verified)
- **Fiscal / order snapshot**: `order-item-builder` (`nameSnapshot`, `goodName`) and
  `fiscalize-order` read the frozen `OrderItem.nameSnapshot` / primary `name` — never the
  translations. Unchanged.
- **Reconstitute callers**: only `menu.mappers` (updated). No other entity/props builders.
- Owner recipe path, taxonomy, edge sync (`as unknown as` passthrough) — untouched.

## Tests (run with `jest`)
- `shared/i18n/locale.spec.ts` — extended with `resolveI18n`: translation-present, missing→
  primary, null-primary→null, description-over-null-primary.
- `menu/domain/entities/menu-i18n.spec.ts` — entity create persists primary + translations
  (missing→null) and the mapper writes the columns; update sets/clears/leaves independently;
  primary-only edits never touch translations; `MenuCategory.rename` carries translations;
  `ModifierOption` round-trips through the mapper.
- `storefront/.../get-public-menu.usecase.spec.ts` (from LOCALE-1) already covers the
  effective-locale resolution feeding `menuTree`. A full `menuTree` DB-level test needs the
  prisma-mock harness; the resolution rule itself is covered by the `resolveI18n` unit tests.

## Order note
LOCALE-2B was gated on 2A (the columns) and LOCALE-1 (the locale seam). Both are now landed,
so 2B's gate is satisfied.
