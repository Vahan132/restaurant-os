-- CATALOG-UNIT-1: measurement unit on platform catalog items (defaults GRAM).
ALTER TABLE "catalog_items" ADD COLUMN "baseUnit" "InventoryBaseUnit" NOT NULL DEFAULT 'GRAM';
