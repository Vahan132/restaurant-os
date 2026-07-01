# CX-1 — Consumer discovery backend (handoff)

A new **`consumer` bounded context** inside the monolith: marketing profile + attributes
taxonomy + per-branch visibility flags + the **anonymous public read API** the Expo
discovery app consumes. No consumer identity (CX-2). No owner-facing write controllers /
admin UI (CX-ADMIN) — but the write **use-cases** ship here so the seed populates data
through real invariants.

## Phase 0 findings (and the two decisions taken)

1. **Listing unit / location ownership — contradiction resolved.** `address`, `phone`,
   `logoUrl`, `openingHours`, `enableReservations` live on **`RestaurantSettings`
   (restaurant-scoped, single-location)**, not on `Branch`. The spec assumed branch-owned
   location. **Decision: Branch stays the listing unit; CX-1 adds branch-owned public
   location fields** (`address`, `city`, `publicPhone`, `BranchPublicHours`, the three
   flags). Brand identity (name on Restaurant, logo on RestaurantSettings,
   about/website/gallery/attributes) is inherited from the parent Restaurant for display.
2. **i18n — contradiction resolved.** The operational catalog stores the **primary locale
   only** (single column; ru/en live only in seed source). The spec's example showed
   per-column hy/ru/en. **Decision: per-column `hy/ru/en` for the NEW consumer tables**
   (a deliberate localized model for consumer-facing copy/reference data). This diverges
   from the catalog convention by design — noted in schema comments.
3. **Branch public id.** `Branch.slug` is unique only **per restaurant**
   (`@@unique([restaurantId, slug])`). Discovery is **cross-restaurant**, so detail is
   addressed by the globally-unique **`branchId`** (matches the spec) and the discovery
   endpoints are **not** behind `PublicRestaurantResolverGuard` (that guard resolves a
   single tenant by host/slug).
4. **Reservation availability reused, PII-stripped.** `GetTableAvailabilityUseCase`
   (reservations) is reused as-is (now exported); it is staff-facing and exposes customer
   names, so the anonymous endpoint maps its output to **PII-free busy windows**.
5. **Errors** follow the per-module `DomainError` pattern (no central registry):
   `src/modules/consumer/domain/consumer.errors.ts`.
6. **Kill switch** `consumerListingSuppressed` added to `Restaurant`; **read** here,
   controlled in CX-ADMIN. Effective listing = `branch.listedInConsumerApp &&
   !restaurant.consumerListingSuppressed` (+ active/not-deleted/org-not-suspended guards).

## New tables (migration `20260719000000_consumer_discovery`)

- `consumer_attribute_categories` (AttributeCategory) — slug, labelHy/Ru/En, position, isFilterable
- `consumer_attribute_values` (AttributeValue) — categoryId→cascade, slug unique-in-category, labels, position
- `consumer_restaurant_attributes` (RestaurantAttribute) — PK (restaurantId, attributeValueId), index on attributeValueId
- `consumer_restaurant_photos` (RestaurantPhoto) — restaurantId→cascade, position, url, altHy/Ru/En, width?, height?
- `consumer_branch_public_hours` (BranchPublicHours) — branchId→cascade, unique (branchId, dayOfWeek); `closesAt < opensAt` ⇒ crosses midnight

New columns: **Restaurant** `aboutHy/aboutRu/aboutEn`, `website`, `consumerListingSuppressed`(default false).
**Branch** `publicPhone`, `address`, `city`, `menuPublic`, `reservationsPublic`,
`listedInConsumerApp` (all default false) + index on `listedInConsumerApp`.

## New routes (anonymous, tag `Discovery`, under `/public/discovery`)

- `GET /public/discovery/attributes` → taxonomy (categories + values, ordered)
- `GET /public/discovery/restaurants?q=&attributeValueIds=&page=&limit=` → effective-listed branch cards (search + AND attribute filter + pagination, all at the DB level)
- `GET /public/discovery/restaurants/:branchId` → full detail; **404 `BRANCH_NOT_LISTED`** if not effectively listed; menu link present only when `menuPublic` (reuses the storefront path `/public/:restaurantSlug/branch/:branchSlug/menu`)
- `GET /public/discovery/restaurants/:branchId/availability?windowStart=&windowEnd=` → reuses reservations availability; **409 `RESERVATIONS_NOT_PUBLIC`** when off; PII-stripped

## New error codes

`BRANCH_NOT_LISTED`, `RESERVATIONS_NOT_PUBLIC`, `RESTAURANT_PROFILE_INCOMPLETE` (carries the
structured missing-field list), `ATTRIBUTE_VALUE_NOT_FOUND`, `INVALID_PHOTO_URL`,
`INVALID_PUBLIC_HOURS`.

## Completeness gate (`SetBranchListed(true)`)

Requires: Restaurant `name` + `logo` (RestaurantSettings.logoUrl) + ≥1 non-empty `about` +
≥1 photo; Branch `address` + ≥1 non-closed hours row. Setting **false** is always allowed.

## Seed (phase `12 consumer`)

Taxonomy = deterministic upserts (10 categories, starter values incl. `Live shows`,
`European`, `Japanese`). The flagship branch is made discoverable **through the real write
use-cases** (marketing profile → 3 https photos → attribute selection → branch contact +
full weekly hours incl. a cross-midnight Fri/Sat → menu/reservations public →
`SetBranchListed(true)`, which passes the gate). `consumerListingSuppressed` stays false.

## Run steps (toolchain — run locally; not runnable in this sandbox)

1. `pnpm prisma migrate dev` (applies `20260719000000_consumer_discovery`) **or**
   `pnpm prisma migrate deploy`.
2. `pnpm prisma generate` — **required**: the new models/fields aren't in the generated
   client yet, so `tsc` will error on `prisma.attributeCategory` etc. until this runs.
3. `pnpm db:seed` (CLOUD mode, Postgres up) — verify the new counts print:
   attributeCategories=10, attributeValues>0, restaurantPhotos=3, restaurantAttributes=8,
   listedBranches=1.
4. `pnpm generate:openapi` — regenerate `openapi.json`; diff the new `Discovery`-tagged paths/schemas.
5. `pnpm lint && pnpm tsc --noEmit` (or the repo's typecheck script).

## Acceptance quick-checks after seed

- `GET /public/discovery/attributes` → 10 categories grouped, ordered.
- `GET /public/discovery/restaurants` → flagship card with hero photo; filter by a selected
  `attributeValueId` includes it, by an unselected value excludes it; pagination works.
- `GET /public/discovery/restaurants/:flagshipBranchId` → full detail, grouped Features,
  gallery, today's hours, `menuUrl` present (menuPublic=true). A non-listed branch → `BRANCH_NOT_LISTED`.
- `.../availability` → data when reservationsPublic=true; `RESERVATIONS_NOT_PUBLIC` when off.
- `SetBranchListed(true)` on an incomplete profile → `RESTAURANT_PROFILE_INCOMPLETE` + missing list.
- Set `consumerListingSuppressed=true` → flagship disappears from list + detail though listed.

**Stop after CX-1.** CX-2 (consumer identity) and the frontend are out of scope.
