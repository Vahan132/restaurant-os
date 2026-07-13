# LOCALE-1 — STEP 1 FINDINGS (inspection only, no code)

Findings-first per the ticket. Anchors are `path:line`. **Headline: the ticket's Step-2
threading target does not exist in the code** — no consumer/storefront/QR endpoint
resolves catalog-sourced (trilingual) names, so there is currently no consumer caller of
`DishProjectionResolver`/`RecipeDetailAssembler` to thread a locale into. Details + a
recommended corrected scope below.

---

## 1. `GetPublicMenuUseCase` + `menuTree` + controller — the threading path

- Controller `public-storefront.controller.ts` — `@Public()`, guarded only by
  `PublicRestaurantResolverGuard` + `ThrottlerGuard`. Menu routes: `menu` (`:59`),
  `branchMenu` (`:79`) → `GetPublicMenuUseCase.execute({restaurantId, branchId?})`.
- `get-public-menu.usecase.ts:21` → `menuCurrency` + `defaultBranchId` + `query.menuTree(restaurantId, branchId)` (`:29`).
- **`menuTree` (`prisma-public-storefront.query.ts:65`) returns monolingual columns only** —
  `category.name`/`description`, `menuItem.name`/`description`, `modifierGroup.name`,
  `modifierOption.name` (lines 118, 132, 149–160). It **does not call**
  `DishProjectionResolver` or `RecipeDetailAssembler`, and returns **no** ingredients,
  recipe, or allergen data. The whole `storefront` module has **zero** references to
  inventory/recipe/dish-projection/allergen (grep clean).

**So the cleanest thread would be** `GetPublicMenuUseCase.execute(…, effectiveLocale)` →
`menuTree(restaurantId, branchId, locale)` — but today that locale would reach nothing
localizable (every field is a single-string column). Threading it now is **dead plumbing
until LOCALE-2** adds trilingual content or a future ticket adds catalog-resolved
ingredient display to the public menu.

## 2. Where `RecipeDetailAssembler.assemble(…, locale)` is called — and by whom

All three call sites are **owner/authenticated `inventory/recipes`**, none consumer/QR:
- `get-recipe.usecase.ts:32` — `assemble(recipe, input.locale ?? 'en')`; the controller
  `recipes.controller.ts:86` reads `?locale` via `toLocale(locale)`. `@BranchScoped`,
  `@RequirePermissions` (`recipes.controller.ts:37`). **Already locale-driven.**
- `create-recipe.usecase.ts:66` and `update-recipe.usecase.ts:60` — `assemble(recipe)`
  with **no locale → defaults `'en'`**. These are owner *write* responses.

`DishProjectionResolver` is otherwise consumed only by `OrderItemAllergenResolver`
(CATALOG-4), which resolves allergen **slugs**, not names — **locale-independent**
(`order-item-allergen.resolver.ts`; orders expose `allergens?: string[] = allergens.slugs`,
`orders/application/dto/responses.ts:44`). Order item names are `nameSnapshot` (monolingual).

**Conclusion for item 2:** the only `en`-default on a catalog-*name* path is the **owner**
recipe create/update response — not a consumer/QR caller. The "guest passing/defaulting
`en`" caller the ticket describes doesn't exist.

## 3. Custom consumer-header convention (for an `X-Locale` reader)

Two established patterns, both header-in-guard:
- `PublicRestaurantResolverGuard` reads `request.headers['x-restaurant-slug']`
  (`public-restaurant.resolver.ts:39`) and builds `PublicContext`
  (`public-context.ts`), injected via `@CurrentPublic()`.
- `X-Session-Token` is read by `SessionTokenGuard` (`table-sessions/.../session-token.guard.ts`).

So an `X-Locale` reader should read `request.headers['x-locale']`. The **natural home is
`PublicRestaurantResolverGuard`**, which already runs on every `/public` route and already
loads the `Restaurant` row (`public-restaurant.resolver.ts:65`) — it can compute the
effective locale once and attach it to `PublicContext`, exposed via `@CurrentPublic()`
(or a dedicated `@GuestLocale()` decorator).

## 4. `Restaurant.defaultLanguage` on the storefront path

Available three ways: the guard already selects the `Restaurant` row (add `defaultLanguage`
to its `select` at `public-restaurant.resolver.ts:66`); `restaurantInfo()` already returns
it (`prisma-public-storefront.query.ts:24,44`; `PublicRestaurantInfo.defaultLanguage`,
`public-query.port.ts:7`); or a small `defaultLanguage(restaurantId)` port method mirroring
`menuCurrency` (`:54`). Column: `Restaurant.defaultLanguage String @default("en")`
(`schema.prisma:168`). **Branch has no locale column** (confirmed — none in the schema).

## 5. Supported-locale set / validator

Canonical validator exists: **`toLocale(value)` + `type Locale = 'hy'|'ru'|'en'`** in
`dish-projection.resolver.ts:17-23` (whitelists `hy|ru|en`, defaults `'en'`). Reuse it for
the `X-Locale` guard rather than duplicating the set. (It lives in the inventory module; a
tiny shared copy or an export is the only choice to consider.)

## 6. Other public endpoints returning localizable names

None surface catalog-resolved (trilingual) names:
- Public menu/table/branches (`public-storefront.controller.ts`) — monolingual columns.
- Public QR orders (`public-qr-orders.controller.ts`, `@Public` + `X-Session-Token`) and
  table-sessions/order-requests public controllers — item names are `nameSnapshot`
  (monolingual), allergens are slugs. No catalog names, no locale.
- Fiscal path — untouched, and correctly so (no locale threaded; no-leak property holds).

**Caching:** there is **no** cache layer on the `/public` path (no `CacheInterceptor`/
`CacheModule`/`Vary` anywhere in `storefront`). So the ticket's `Vary: X-Locale` note is
**moot today** — flag it as a requirement for whoever later adds public-menu caching.

---

## RECOMMENDATION (the corrected scope)

The ticket's non-negotiables — *"signal + resolution + threading only; no menu data-model
change"* — split cleanly into a part that's real today and a part that has no target yet:

**A. Buildable now (the actual LOCALE-1 foundation) — recommended.**
Add the guest-locale **signal + resolution** on `/public`: read `X-Locale`
(`request.headers['x-locale']`), validate with the existing `toLocale`, compute
`effectiveLocale = validXLocale ?? restaurant.defaultLanguage ?? 'en'` **once** in
`PublicRestaurantResolverGuard` (it already has the `Restaurant` row), attach to
`PublicContext`, expose via `@CurrentPublic()`/`@GuestLocale()`. Thread it into
`GetPublicMenuUseCase` → `menuTree(…, locale)` so the plumbing is ready — **with an explicit
`// NOTE:` that it is a no-op on output until there's catalog-resolved content on the public
menu (LOCALE-2 / a later ingredient-display ticket).** This is honest foundation and changes
no data model.

**B. The only genuine `en`-collapse bug is elsewhere (owner path).**
`create-recipe`/`update-recipe` call `assemble(recipe)` (default `'en'`) — an owner surface,
not a guest one. Fixing it is worthwhile but is **not** the guest-locale concern LOCALE-1
describes; it's a separate small ticket.

**What I recommend against:** threading `effectiveLocale` "into
`DishProjectionResolver`/`RecipeDetailAssembler`" on the consumer path as literally written
(ticket §2.2) — that path never invokes them, so there is nothing to thread into. Doing it
would mean inventing a consumer ingredient/recipe surface, which is LOCALE-2 / feature-
bundling and explicitly out of scope.

**Decision needed before Step 2** (findings-first, no feature bundling): ship **A** (the
signal + resolver foundation, plumbing threaded but a documented no-op on output), and
optionally fold in **B** (owner recipe `en`-default fix) — or hold. I have not written any
Step 2 code.
