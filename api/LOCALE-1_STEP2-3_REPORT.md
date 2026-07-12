# LOCALE-1 — STEP 2/3 REPORT (implementation)

Implements the **signal + effective-locale foundation** on the consumer/storefront path —
the real, depended-upon deliverable (LOCALE-2B "consumes the `@GuestLocale()` from
LOCALE-1"). Per the Step 1 findings, there is no catalog-resolved name on the public path
yet, so this threads the locale to the exact seam LOCALE-2B fills (`menuTree(..., locale)`)
and documents it as a no-op on output until then. No menu data-model change, no fiscal
change, no owner-path change.

> ⚠️ **Run on your machine** (sandbox has no prisma binary): `tsc --noEmit` → `jest` →
> OpenAPI regen (a request header + input signature changed).

## The locale resolver + signal

- **New `shared/i18n/locale.ts`** — the shared supported-locale set: `SUPPORTED_LOCALES =
  ['hy','ru','en']`, `type Locale`, `isSupportedLocale`, `parseLocale(value): Locale | null`
  (case-insensitive, trimmed; **null when unset/invalid** so callers can fall back), and
  `resolveEffectiveLocale(requested, restaurantDefault): Locale` = `requested ??
  parseLocale(default) ?? 'en'` (the restaurant default is validated too — an unsupported
  default never leaks). Inventory's private `toLocale` (owner recipe path) is left as-is to
  avoid churn; both agree on `hy|ru|en`.
- **New `shared/storefront/guest-locale.decorator.ts`** — `@GuestLocale()` reads
  `request.headers['x-locale']` (same `request.headers['x-...']` convention the resolver
  guard uses for `X-Restaurant-Slug`), returns `Locale | null`. It deliberately does **not**
  apply the restaurant-default fallback — that lives in the use-case, which has `restaurantId`.

## Threading (computed once per request, in the use-case)

- **`get-public-menu.usecase.ts`** — `GetPublicMenuInput.requestedLocale?: Locale | null`;
  the use-case fetches `defaultLanguage`, computes `resolveEffectiveLocale(requested,
  default)`, and passes it to `menuTree`.
- **`public-query.port.ts`** — added `defaultLanguage(restaurantId): Promise<string>`;
  `menuTree` signature is now `(restaurantId, branchId, locale: Locale)` with a doc-comment
  that LOCALE-2B resolves `column(locale) ?? name` here.
- **`prisma-public-storefront.query.ts`** — implemented `defaultLanguage` (reads
  `Restaurant.defaultLanguage`, defaults `'en'`); `menuTree` accepts `_locale: Locale` with
  a `// NOTE:` that the menu is monolingual today so the param does not change output yet.
- **`public-storefront.controller.ts`** — `menu` and `branchMenu` take `@GuestLocale()
  locale` and pass `requestedLocale`; both documented with `@ApiHeader('X-Locale')`. A `//
  NOTE:` records that **no cache layer exists on `/public` today**, so `Vary: X-Locale` is
  moot — but is required if caching is ever added.

Only implementer (`PrismaPublicStorefrontQuery`) and only caller (the use-case) were
updated; no other `menuTree`/port call sites exist.

## Explicitly NOT touched (scope)

- **Fiscal / order-snapshot**: untouched. LOCALE-1 has no code path into orders/fiscal;
  they keep reading `OrderItem.nameSnapshot` (frozen at order-build). The no-leak property
  holds — guest locale never reaches the fiscal payload.
- **Owner recipe path** (`create/update/get-recipe` `assemble(...)` `en`-default): left as-is
  — it's an authenticated owner surface, not the guest-locale concern (flagged in Step 1 as
  a separate small ticket).
- **Menu content columns, storefront emission, authoring UI, QR/Expo `X-Locale` sending**:
  out of scope (LOCALE-2A/2B/2C/2D).

## Response-shape / API delta (for OpenAPI regen)

- New **optional request header `X-Locale`** on `GET /public/menu` and
  `GET /public/:restaurantSlug/branch/:branchSlug/menu`. No response body change.

## Tests (run with `jest`)

- **New `shared/i18n/locale.spec.ts`** — `parseLocale` (accepts hy/ru/en, normalizes case/
  whitespace, null for `fr`/blank/undefined/null) and `resolveEffectiveLocale` precedence
  (request > default > en; unsupported default → en).
- **New `get-public-menu.usecase.spec.ts`** — `X-Locale: hy` → `menuTree` called with `hy`;
  absent → restaurant `defaultLanguage`; unsupported default → `en`; branch-explicit path
  threads it too.

## Honest status

Until the QR web / Expo apps actually send `X-Locale` (frontend follow-ups) the restaurant
default applies — no regression, no behavior change for existing clients. And because the
public menu is still monolingual, a sent `X-Locale` changes nothing visible **yet**;
LOCALE-2A adds trilingual storage and LOCALE-2B makes `menuTree` resolve against this locale.
This ticket delivers the signal + `@GuestLocale()` those depend on.
