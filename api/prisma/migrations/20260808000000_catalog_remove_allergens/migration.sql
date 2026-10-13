-- CATALOG — Remove the allergen feature.
--   The allergen implementation is being withdrawn in full and will be redesigned
--   from scratch, so the schema drops rather than deprecates:
--
--   catalog_item_allergens : the CatalogItem <-> Allergen join (cascade both sides).
--   catalog_allergens      : the platform allergen taxonomy (seeded EU-14 set).
--   catalog_items.allergensReviewed : the support tagging gate.
--   inventory_items.allergen_override : the tenant override. It had no write path
--     in the API (read + seed only), so dropping it loses no reachable behaviour.
--
--   No other table references these; the join cascades from both sides and no FK
--   points at catalog_allergens from tenant data, so the drops are clean.
--   IF EXISTS keeps the migration safe on a database provisioned before CATALOG-1.

-- DropTable
DROP TABLE IF EXISTS "catalog_item_allergens";

-- DropTable
DROP TABLE IF EXISTS "catalog_allergens";

-- AlterTable
ALTER TABLE "catalog_items" DROP COLUMN IF EXISTS "allergensReviewed";

-- AlterTable
ALTER TABLE "inventory_items" DROP COLUMN IF EXISTS "allergen_override";
