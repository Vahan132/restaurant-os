# LOCALE-2C — Step 1 Findings (inspect & report, NO CODE)

Admin app, tenant `(app)` menu builder only. All paths under `src/` unless noted.

---

## Prereq — codegen is STALE, must regenerate before Step 2

The **spec** already has the LOCALE-2A fields, but the **generated TypeScript client does not**. This is a blocker for 2.2 and must be fixed first.

- `src/api/generated/model/createMenuItemDto.ts`, `updateMenuItemDto.ts`, `menuItemResponse.ts`, and the category / modifier-group / modifier-option DTOs+responses have **no** `nameHy/Ru/En`, `descriptionHy/Ru/En`, `nameI18n`, or `descriptionI18n`. Verified by grep — zero i18n hits across the generated `model/` folder.
- The bundled spec `admin/openapi.json` (Jun/Jul) *does* contain them, but that file is **truncated / invalid JSON** (fails to parse ~line 25314; ends mid-object). Do not regenerate from it.
- The uploaded spec `…-1783849995326_openapi.json` is **complete and valid** and carries the full i18n surface. Use it as the codegen input.

`// NOTE: LOCALE-2C prereq — replace admin/openapi.json with the complete uploaded spec, then regenerate orval (see res-admin-build-env memory for the sandbox codegen recipe). Do NOT hand-write the DTO fields.`

### What the spec (uploaded, authoritative) defines

Set-null semantics: every flat translation field is `type: string, nullable: true` on both create and update DTOs. `name` stays required on create; everything else optional. Responses expose an `I18nTextResponse` object `{ hy: string|null, ru: string|null, en: string|null }` (all three keys required-present, values nullable).

| Entity | Create/Update DTO adds | Response adds |
|---|---|---|
| **Menu item** (`CreateMenuItemDto`/`UpdateMenuItemDto`) | `nameHy/Ru/En`, `descriptionHy/Ru/En` | `MenuItemResponse` + `MenuItemDetailResponse`: `nameI18n`, `descriptionI18n` |
| **Category** (`CreateCategoryDto`/`UpdateCategoryDto`) | `nameHy/Ru/En`, `descriptionHy/Ru/En` | `CategoryResponse`: `nameI18n`, `descriptionI18n` |
| **Modifier group** (`CreateModifierGroupDto`/`UpdateModifierGroupDto`) | `nameHy/Ru/En` | `ModifierGroupResponse` (+ `WithOptions`, `Attached`): `nameI18n` |
| **Modifier option** (`CreateModifierOptionDto`/`UpdateModifierOptionDto`) | `nameHy/Ru/En` | `ModifierOptionResponse`: `nameI18n` |

Note: item/category get name **and** description translations; modifier group/option get **name only** — matching the ticket. (Catalog DTOs already carry `nameHy/Ru/En`, but that's platform-catalog, out of scope.)

---

## §1 — The four menu-builder forms and their save paths

Shared primitives (all four): `Field` + `inputClass` from `components/ui/form.tsx`; `Modal` (`components/ui/modal.tsx`) for category/group/option, `Drawer` (`components/ui/drawer.tsx`) for the item editor; `Button`. **No react-hook-form, no zod** — every form is controlled `useState` with manual trim/`!name.trim()` validation, server errors via `getErrorMessage` + `toast`.

### 1. Menu item — `ItemEditorDrawer`
`// NOTE:` `components/menu/item-editor-drawer.tsx:41` (mounted at `components/menu/menu-manager.tsx:77`).
- Name input `:298-305` → `name` state `:80`; Description `<textarea>` `:306-314` → `description` state `:81`. **Both name + description.**
- Hooks from `@/api/generated/menu-items/menu-items` (`:6-13`): `useItemsControllerCreate` `:121`, `useItemsControllerUpdate` `:122`, `useItemsControllerGet` `:71`.
- Save handler `:143-237`: create `create.mutateAsync({ data: { name, categoryId, description: description.trim() || undefined, … } })` `:152`; update `update.mutateAsync({ id: workingId, data: { name, description…, categoryId } })` `:195`. (Price/status/availability/adgCode are separate post-create patches — irrelevant to 2C.)
- **Prefill:** `useItemsControllerGet(workingId)` → `useEffect` `:102-115` copies `detail.name`, `detail.description ?? ''` into state. Add `nameI18n`/`descriptionI18n` reads here.

### 2. Category — `CategoryFormModal`
`// NOTE:` `components/menu/category-form-modal.tsx:18` (mounted at `components/menu/categories-panel.tsx:198`).
- Name input `:95-102` → `name` `:35`; Description `<textarea>` `:103-110` → `description` `:36`. **Both name + description.**
- Hooks from `@/api/generated/menu-categories/menu-categories` (`:6-9`): `useCategoriesControllerCreate` `:39`, `useCategoriesControllerUpdate` `:40`.
- `onSubmit` `:49-76`: update `:58`, create `:64`.
- **Prefill:** reads the `category?: CategoryResponse` **prop directly** in `useState` initializers `:35-36` — no fetch/effect. Prefill i18n from `category?.nameI18n` / `descriptionI18n` here.

### 3. Modifier group — `ModifierGroupFormModal`
`// NOTE:` `components/menu/modifier-group-form-modal.tsx:29` (mounted at `modifier-groups-editor.tsx:271` and `modifier-group-library.tsx:225`).
- Name input `:131-138` → `name` `:44`. **Name only — no description field/state exists.**
- Hooks from `@/api/generated/menu-modifier-groups/menu-modifier-groups` (`:6-9`): `useModifierGroupsControllerCreate` `:57`, `useModifierGroupsControllerUpdate` `:58`.
- `submit` `:62-112`: builds `base = { name, selectionType, required, minSelect, maxSelect }` `:93-99`; update/create at `:102-105`.
- **Prefill:** `group?: ModifierGroupResponse` prop in `useState` init `:44-54`. Add `nameI18n` prefill here.

### 4. Modifier option — `ModifierOptionFormModal`
`// NOTE:` `components/menu/modifier-option-form-modal.tsx:26` (mounted at `modifier-group-options-editor.tsx:172`).
- Name input `:118-125` → `name` `:48`. **Name only.**
- Option CRUD is nested under the modifier-groups controller (`@/api/generated/menu-modifier-groups/menu-modifier-groups`, `:6-9`): `useModifierGroupsControllerAddOptionToGroup` `:58`, `useModifierGroupsControllerPatchOption` `:59`.
- `submit` `:62-99`: patch `:72` (`{ groupId, optionId, data: { name, priceDeltaAmount, isDefault, status } }`), add `:83`.
- **Prefill:** `option?: ModifierOptionResponse` prop in `useState` init `:48-55`. Add `nameI18n` prefill here.

---

## §2 — Existing trilingual pattern to REUSE

`// NOTE:` A reusable `{hy,ru,en}` editor already exists: **`I18nTextEditor`** at `components/consumer-listing/i18n-text-editor.tsx`.

- Type `I18nDraft = Record<Locale,string>` (never-null editable shape); `EMPTY_I18N` blank draft `:8-28`.
- Helpers: `toI18nDraft(nullableApiObj)` → full draft (`:14`); `fromI18nDraft(draft)` → payload with empty strings coerced to `null` (`:25`).
- Props `:30-42`: `value: I18nDraft`, `onChange`, `disabled?`, `multiline?` (textarea vs input), `rows?` (default 3).
- Renders one row per locale `:46-73`, labeled from `localeNames[locale]` (endonyms), placeholder `t('i18nPlaceholder', { lang })` under the `consumerListing` namespace.
- Depends only on `@/i18n/config` and `inputClass` — drops into any form.
- **In use:** `consumer-listing/restaurant-panel.tsx` (About, `multiline`, `:48/:53/:63/:98`) and `photos-editor.tsx:226` (alt text, single-line).

**Reuse caveat / decision needed:** `I18nTextEditor` speaks the **nested `{hy,ru,en}`** shape (like the consumer `about` field). The LOCALE-2C menu DTOs use the **flat `nameHy/Ru/En`** shape. So the wrapper `TranslationFields` should map flat ↔ nested (small adapter: `{hy,ru,en}` → `nameHy/Ru/En` on save, `nameI18n` → draft on prefill) and render the two **non-primary** locales only (the existing editor renders all three). Options: (a) reuse `I18nTextEditor` as-is inside `TranslationFields` and hide the primary row, or (b) mirror its markup rendering only 2 rows. Recommend (b) — cleaner given the "two non-primary only" rule and the flat DTO shape — while reusing `localeNames` and the `inputClass`/`Field` primitives for visual consistency. Also add a menu-namespace `i18nPlaceholder`-style key rather than borrowing `consumerListing`.

(Non-reusable alt: `platform-catalog/catalog-item-form.tsx:149-157` hand-rolls three `nameHy/Ru/En` `<Field>`s with hardcoded `(HY)/(RU)/(EN)` labels — matches the flat shape but not reusable, ignores `localeNames`.)

---

## §3 — Reading the restaurant `defaultLanguage`

`// NOTE:` Existing hook — **`useRestaurant()`** at `lib/restaurant/use-restaurant.ts:18-29` (React Query key `['restaurant']`, GET `/restaurant`, `staleTime 5m`). Its `Restaurant` interface exposes `defaultLanguage: string` (`:12`) — a raw code `"hy"|"ru"|"en"`. No new backend read needed.

- Already consumed for `defaultLanguage` at `components/settings/profile-tab.tsx:21/:35`. ~30 other call sites use it for currency/name/timezone.
- Generated model also declares it: `model/restaurantResponse.ts:16`, `updateRestaurantProfileDto.ts:12`.
- **Derive the two translation locales** as `locales` minus `defaultLanguage`. Guard for the value not being one of `hy|ru|en` (fall back to showing both non-`en`, or all-minus-default).

---

## §4 — Admin i18n (labels for the language inputs)

`// NOTE:` next-intl. `useLocale()` / `useTranslations()` from `next-intl`.
- Central config `i18n/config.ts`: `locales = ['en','ru','hy']` `:1`, `type Locale` `:2`, `defaultLocale='en'` `:4`, and the **language-name map** `localeNames = { en:'English', ru:'Русский', hy:'Հayeren' }` `:9-13` (endonyms) — reuse this for input labels; no per-language message keys exist.
- Active locale resolves from the `LOCALE` cookie in `i18n/request.ts:12-13` (falls back to `defaultLocale`; restaurant `defaultLanguage` is intentionally **not** wired into the UI locale — they're separate concerns, don't conflate).
- **Message catalogs** live in the top-level `messages/` folder (`en.json`, `ru.json`, `hy.json`), **not** under `src`. Namespaces via `useTranslations('<namespace>')` (e.g. `'menu'`, `'common'`). Add any new label/placeholder keys to all three catalogs.
- `localeNames` is consumed by `components/i18n/language-switcher.tsx:33-37`.

---

## Step-2 plan implied by findings (for the follow-up)

1. **Regenerate first:** copy the complete uploaded spec over `admin/openapi.json`, run orval (sandbox recipe in memory), confirm the four DTOs/responses now carry the fields.
2. **Build `TranslationFields`** (flat ↔ nested adapter, renders the two non-primary locales from `defaultLanguage`, name-only vs name+description modes, reuses `localeNames`/`Field`/`inputClass`).
3. **Wire the four forms:** label the existing primary input with `localeNames[defaultLanguage]`; mount `TranslationFields`; prefill from `*I18n` (item via `useEffect`, the other three from their prop initializers); on save send the two non-primary values as flat `nameHy/Ru/En` (+`descriptionHy/Ru/En` for item/category), empty → `null` per the nullable DTO convention. Guard double-submit (existing pattern).
4. **Verify:** regenerate → typecheck/build green → manual CRUD pass per entity.

Out of scope (unchanged): backend, storefront/consumer side, `X-Locale` send (2D), platform-admin.
