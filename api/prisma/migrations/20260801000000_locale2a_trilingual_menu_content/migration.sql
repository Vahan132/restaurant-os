-- LOCALE-2A: trilingual menu content. Additive, nullable translation columns for
-- name (all four entities) and description (MenuItem + MenuCategory only). The
-- existing `name`/`description` stay as the required primary (authored in
-- Restaurant.defaultLanguage). No backfill: existing rows keep null translations and
-- render the primary until translated (LOCALE-2B resolves column(locale) ?? name).
-- Column names are camelCase (unmapped), matching the CatalogItem.nameHy/Ru/En precedent.

ALTER TABLE "menu_items"
  ADD COLUMN "nameHy" TEXT,
  ADD COLUMN "nameRu" TEXT,
  ADD COLUMN "nameEn" TEXT,
  ADD COLUMN "descriptionHy" TEXT,
  ADD COLUMN "descriptionRu" TEXT,
  ADD COLUMN "descriptionEn" TEXT;

ALTER TABLE "menu_categories"
  ADD COLUMN "nameHy" TEXT,
  ADD COLUMN "nameRu" TEXT,
  ADD COLUMN "nameEn" TEXT,
  ADD COLUMN "descriptionHy" TEXT,
  ADD COLUMN "descriptionRu" TEXT,
  ADD COLUMN "descriptionEn" TEXT;

ALTER TABLE "modifier_groups"
  ADD COLUMN "nameHy" TEXT,
  ADD COLUMN "nameRu" TEXT,
  ADD COLUMN "nameEn" TEXT;

ALTER TABLE "modifier_options"
  ADD COLUMN "nameHy" TEXT,
  ADD COLUMN "nameRu" TEXT,
  ADD COLUMN "nameEn" TEXT;
