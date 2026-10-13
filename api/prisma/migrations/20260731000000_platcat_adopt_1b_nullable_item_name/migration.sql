-- PLATCAT-ADOPT-1B: the platform owns an adopted item's name.
-- An adopted InventoryItem no longer stores its own name; it resolves the catalog's
-- trilingual name live at read time. So `name` becomes nullable. Every item must
-- still have an identity source, enforced by a CHECK: a local name OR a catalog link.
--
-- Safe / no backfill: every existing row has a non-null name, so both the nullability
-- relaxation and the CHECK hold for all current data. No index/unique touches `name`.

ALTER TABLE "inventory_items" ALTER COLUMN "name" DROP NOT NULL;

ALTER TABLE "inventory_items"
  ADD CONSTRAINT "inventory_items_name_or_catalog_ck"
  CHECK ("name" IS NOT NULL OR "catalogItemId" IS NOT NULL);
