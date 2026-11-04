-- ADGCODE-CLEANUP-1: remove non-sellable adgCode modeling mistakes.
-- Only sellable things (menu items) carry adgCode. CatalogItem.adgCode and
-- InventoryItem.adgCodeOverride were dead: no constraints, no consumers of the
-- computed "effective adgCode" (produced and discarded), and adgCodeOverride had
-- no domain field or write path (always null). MenuItem.adgCode / OrderItem.adgCode
-- and all fiscalization are untouched.
--
-- Both columns are plain nullable TEXT with no FK/unique/index, so DROP cascades
-- nothing. No data concern: seed-only illustrative values on 2 catalog items; the
-- override column was always null.

ALTER TABLE "catalog_items" DROP COLUMN "adg_code";

ALTER TABLE "inventory_items" DROP COLUMN "adg_code_override";
