-- Prompt 6C: per-item default CONSUMPTION location (where an item is depleted on
-- serve). Seeded to each branch's Main Storage to preserve current behavior
-- (post-6A all stock lives in Main Storage). Null falls back to Main Storage via
-- the resolver, so the backfill is for explicitness. Additive + idempotent.

ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "consumptionLocationId" TEXT;

-- Backfill existing items to their branch's default (Main Storage) location id —
-- resolved from the actual row (works whether seeded by migration or runtime).
UPDATE "inventory_items" i
SET "consumptionLocationId" = l."id"
FROM "inventory_locations" l
WHERE l."restaurantId" = i."restaurantId"
  AND l."branchId" = i."branchId"
  AND l."isDefault" = true
  AND l."deletedAt" IS NULL
  AND i."consumptionLocationId" IS NULL;
