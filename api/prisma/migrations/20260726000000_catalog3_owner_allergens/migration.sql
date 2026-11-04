-- CATALOG-3 — Owner-side allergens: dual-depth resolution + projections.
--   Two additive, nullable-safe boolean columns; safe on all existing rows.
--
--   catalog_items.allergensReviewed (default false): platform-support tagging gate
--     (§Locked-4). A leaf is VERIFIED only when catalogSourced AND allergensReviewed;
--     un-reviewed catalog items therefore count as unverified until support flips it.
--   menu_items.hideRecipe (default false): hides the CUSTOMER ingredient list but NOT
--     the allergen summary (ADR §9) — safety is never secrecy.

-- AlterTable
ALTER TABLE "catalog_items" ADD COLUMN "allergensReviewed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN "hideRecipe" BOOLEAN NOT NULL DEFAULT false;
