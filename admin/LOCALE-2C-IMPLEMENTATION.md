# LOCALE-2C — Implementation Report

Trilingual menu authoring in the tenant `(app)` menu builder. Admin only; no backend, no storefront, no platform side.

## Codegen (prereq)

The generated client was stale (no i18n fields) and the bundled `openapi.json` was truncated/invalid. Fixed:

- Replaced `admin/openapi.json` with the complete uploaded spec (359 schemas, valid JSON).
- Regenerated orval (v8.14.0, react-query 5.100.14) in the sandbox per the `res-admin-build-env` recipe and copied **only** the 15 model files that genuinely changed — the four entities' create/update DTOs and their responses now carry the LOCALE-2A fields:
  - Create/Update DTOs gained flat, nullable `nameHy/Ru/En` (+ `descriptionHy/Ru/En` on item & category).
  - Responses gained `nameI18n` / `descriptionI18n` (`I18nTextResponse` = `{hy,ru,en}`, each `string | null`). `I18nTextResponse` already existed and is exported — no barrel change needed.
- Left everything else untouched (tag/hook files were byte-identical; `adgCode` and other models unchanged).

## New shared component — `src/components/menu/translation-fields.tsx`

`TranslationFields` renders optional inputs for the **two non-primary** locales (derived from `hy|ru|en` minus the restaurant's `defaultLanguage`), each labeled `"<field> (<LanguageName>)"` using the existing `localeNames` map. It reuses the consumer-listing `I18nDraft` / `toI18nDraft` / `fromI18nDraft` / `EMPTY_I18N` helpers for a consistent `{hy,ru,en}` shape, and the shared `Field` / `inputClass` primitives. Single-set (name **or** description); item/category mount it twice.

Also exports typed flat-mapping helpers used on save:

- `nameTranslationFields(primaryLocale, draft)` → `{ nameHy?, nameRu?, nameEn? }` — sends the two non-primary values (empty → `null`, which clears on update) and leaves the **primary** column `undefined` (omitted → unchanged; resolution falls back to `name`).
- `descriptionTranslationFields(...)` → `{ descriptionHy?, descriptionRu?, descriptionEn? }`.
- `resolvePrimaryLocale` / `primaryLocaleName` — guard the raw `defaultLanguage` string to a known locale and its display name.

## Four forms wired

Each reads `defaultLanguage` from the existing `useRestaurant()` hook (no new backend read), labels its primary field with the default language, mounts `TranslationFields`, prefills from `*I18n`, and spreads the flat helpers into the existing create/update payloads. Double-submit is guarded by the forms' existing `submitting` flags.

| Form | File | Fields | Prefill source |
|---|---|---|---|
| Menu item | `item-editor-drawer.tsx` | name + description | `useItemsControllerGet` → `useEffect` (`toI18nDraft(detail.nameI18n / descriptionI18n)`) |
| Category | `category-form-modal.tsx` | name + description | `category` prop in `useState` init |
| Modifier group | `modifier-group-form-modal.tsx` | name | `group` prop in `useState` init |
| Modifier option | `modifier-option-form-modal.tsx` | name | `option` prop in `useState` init |

## Verification

- Regenerated DTOs/responses confirmed to carry the i18n fields (all four responses expose `nameI18n`; item/category also `descriptionI18n`).
- Scoped `tsc` (isolated deps, per the sandbox recipe) over all five changed files: **clean (exit 0)**.
  - Note: `item-editor-drawer` surfaced two type errors on **pre-existing** `adgCode` lines (191, 207). The spec declares `adgCode` as `type: object, nullable: true` (a free-text field mis-declared as an object), so orval renders it `{[key:string]:unknown}|null` in both the committed repo and the regen; the existing `adgCode: adgCode.trim()` (string) assignment mismatches that type **independently of LOCALE-2C**. None of the i18n changes produced errors.

## Files changed

- `openapi.json` (replaced with complete spec)
- `src/api/generated/model/` — 15 regenerated i18n model files (item/category/modifier-group/modifier-option create+update DTOs and responses)
- `src/components/menu/translation-fields.tsx` (new)
- `src/components/menu/item-editor-drawer.tsx`
- `src/components/menu/category-form-modal.tsx`
- `src/components/menu/modifier-group-form-modal.tsx`
- `src/components/menu/modifier-option-form-modal.tsx`

## Manual test checklist (per ticket Step 3.2)

Create a dish with a primary name plus Russian & Armenian translations → all persist; edit reloads translations into the right inputs; clearing a translation clears it (sends `null`); a dish with no translations still saves and shows only the primary. Repeat for category / modifier group / option.

## Out of scope (unchanged)

Backend, storefront/consumer side, `X-Locale` send (2D), platform-admin, and the pre-existing `adgCode` type quirk.
