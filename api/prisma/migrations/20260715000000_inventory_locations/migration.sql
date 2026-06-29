-- Prompt 6A: multi-location inventory FOUNDATION.
--
-- Adds physical stock locations (shelves), makes the FIFO lots (inventory_stock_layers)
-- and the append-only movement ledger (inventory_stock_movements) location-aware,
-- materializes a per-(item, location) on-hand projection, seeds a per-branch
-- negative-stock policy, and a pre-zero low-stock alert table.
--
-- LEDGER NOTE: this codebase already had an append-only ledger (inventory_stock_movements,
-- INV-1) that fully reconciles to on-hand. The migration therefore relocates the
-- EXISTING ledger + lots into each branch's Main Storage and BUILDS the on-hand
-- projection by summing the existing ledger — it deliberately does NOT inject
-- duplicate OPENING entries (that would double-count valuation). OPENING is wired
-- as a supported type for seeding brand-new (item, location) balances going forward.
--
-- Idempotent + additive: guarded enum creation, IF NOT EXISTS tables/columns/indexes,
-- ON CONFLICT DO NOTHING seeds, deterministic seeded ids. Safe to re-run.

-- ── 0. New enum values on the existing ledger type (reserved for 6A/6B) ───────
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'OPENING';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'TRANSFER_OUT';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'TRANSFER_IN';

-- ── 1. New enums ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "InventoryLocationType" AS ENUM ('KITCHEN', 'BAR', 'MAIN_STORAGE', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryLocationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NegativeStockMode" AS ENUM ('ALLOW', 'WARN', 'BLOCK');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "LowStockAlertStatus" AS ENUM ('OPEN', 'RESOLVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── 2. New tables ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "inventory_locations" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "systemType" "InventoryLocationType" NOT NULL DEFAULT 'CUSTOM',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" "InventoryLocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "inventory_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "inventory_stock_on_hand" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "lowStockThresholdBase" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_stock_on_hand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "inventory_branch_policies" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "negativeStockMode" "NegativeStockMode" NOT NULL DEFAULT 'WARN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_branch_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "inventory_low_stock_alerts" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "thresholdBase" INTEGER NOT NULL,
    "onHandBase" INTEGER NOT NULL,
    "status" "LowStockAlertStatus" NOT NULL DEFAULT 'OPEN',
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "inventory_low_stock_alerts_pkey" PRIMARY KEY ("id")
);

-- ── 3. Indexes on the new tables ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "inventory_locations_restaurantId_idx" ON "inventory_locations"("restaurantId");
CREATE INDEX IF NOT EXISTS "inventory_locations_restaurantId_branchId_idx" ON "inventory_locations"("restaurantId", "branchId");
CREATE INDEX IF NOT EXISTS "inventory_locations_restaurantId_branchId_systemType_idx" ON "inventory_locations"("restaurantId", "branchId", "systemType");

CREATE UNIQUE INDEX IF NOT EXISTS "inv_on_hand_item_location_key" ON "inventory_stock_on_hand"("itemId", "locationId");
CREATE INDEX IF NOT EXISTS "inventory_stock_on_hand_restaurantId_branchId_idx" ON "inventory_stock_on_hand"("restaurantId", "branchId");
CREATE INDEX IF NOT EXISTS "inventory_stock_on_hand_restaurantId_branchId_locationId_idx" ON "inventory_stock_on_hand"("restaurantId", "branchId", "locationId");

CREATE UNIQUE INDEX IF NOT EXISTS "inv_branch_policy_rest_branch_key" ON "inventory_branch_policies"("restaurantId", "branchId");
CREATE INDEX IF NOT EXISTS "inventory_branch_policies_restaurantId_idx" ON "inventory_branch_policies"("restaurantId");

CREATE INDEX IF NOT EXISTS "inventory_low_stock_alerts_restaurantId_branchId_status_idx" ON "inventory_low_stock_alerts"("restaurantId", "branchId", "status");
CREATE INDEX IF NOT EXISTS "inv_low_stock_alert_scope_idx" ON "inventory_low_stock_alerts"("restaurantId", "branchId", "itemId", "locationId", "status");

-- ── 4. Add locationId to the existing lots + ledger (NULLABLE first) ──────────
ALTER TABLE "inventory_stock_layers"    ADD COLUMN IF NOT EXISTS "locationId" TEXT;
ALTER TABLE "inventory_stock_movements" ADD COLUMN IF NOT EXISTS "locationId" TEXT;

-- ── 5. Seed three system locations per existing branch (Main Storage = default) ─
--      Deterministic ids make the seed idempotent and let later backfills point at
--      the right Main Storage row.
INSERT INTO "inventory_locations" ("id", "restaurantId", "branchId", "name", "systemType", "isDefault", "status", "createdAt", "updatedAt")
SELECT 'iloc_' || b."id" || '_MAIN', b."restaurantId", b."id", 'Main Storage', 'MAIN_STORAGE', true, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "branches" b
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "inventory_locations" ("id", "restaurantId", "branchId", "name", "systemType", "isDefault", "status", "createdAt", "updatedAt")
SELECT 'iloc_' || b."id" || '_KITCHEN', b."restaurantId", b."id", 'Kitchen', 'KITCHEN', false, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "branches" b
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "inventory_locations" ("id", "restaurantId", "branchId", "name", "systemType", "isDefault", "status", "createdAt", "updatedAt")
SELECT 'iloc_' || b."id" || '_BAR', b."restaurantId", b."id", 'Bar', 'BAR', false, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "branches" b
ON CONFLICT ("id") DO NOTHING;

-- ── 6. Relocate existing lots + ledger into each branch's Main Storage ───────
--      Branch already follows the item (BR-3), so Main Storage of that branch is
--      the correct target. Preserves cost + FIFO order exactly (no rows touched
--      beyond locationId).
UPDATE "inventory_stock_layers" t
SET "locationId" = 'iloc_' || t."branchId" || '_MAIN'
WHERE t."locationId" IS NULL;

UPDATE "inventory_stock_movements" t
SET "locationId" = 'iloc_' || t."branchId" || '_MAIN'
WHERE t."locationId" IS NULL;

-- ── 7. Enforce NOT NULL + add the location-aware indexes ─────────────────────
ALTER TABLE "inventory_stock_layers"    ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "inventory_stock_movements" ALTER COLUMN "locationId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "inv_stock_layer_loc_item_status_recv_idx" ON "inventory_stock_layers"("locationId", "itemId", "status", "receivedAt");
CREATE INDEX IF NOT EXISTS "inv_stock_mov_loc_item_idx" ON "inventory_stock_movements"("locationId", "itemId");

-- ── 8. Build the on-hand projection by summing the EXISTING ledger ───────────
--      All movements now carry Main Storage's locationId, so grouping by
--      (item, location) reproduces current on-hand exactly. Rebuildable any time
--      by re-running this aggregate.
INSERT INTO "inventory_stock_on_hand" ("id", "restaurantId", "branchId", "itemId", "locationId", "quantity", "lowStockThresholdBase", "createdAt", "updatedAt")
SELECT 'ioh_' || m."itemId" || '_' || m."locationId",
       m."restaurantId", m."branchId", m."itemId", m."locationId",
       SUM(m."baseQty")::int, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "inventory_stock_movements" m
GROUP BY m."restaurantId", m."branchId", m."itemId", m."locationId"
ON CONFLICT ("itemId", "locationId") DO NOTHING;

-- ── 9. Seed the per-branch negative-stock policy (default WARN, §4) ──────────
INSERT INTO "inventory_branch_policies" ("id", "restaurantId", "branchId", "negativeStockMode", "createdAt", "updatedAt")
SELECT 'ibp_' || b."id", b."restaurantId", b."id", 'WARN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "branches" b
ON CONFLICT ("restaurantId", "branchId") DO NOTHING;
