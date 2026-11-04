-- Prompt 6B: within-branch stock transfers (relocation at carrying cost, NO COGS).
--
-- Reuses the location-aware ledger from 6A (StockMovement TRANSFER_OUT/TRANSFER_IN
-- + the now location-scoped StockLayer). These tables only RECORD transfer headers
-- and the consumed-slice audit trail; the actual stock movement is the existing
-- ledger. Additive + idempotent.

CREATE TABLE IF NOT EXISTS "inventory_transfers" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "fromLocationId" TEXT NOT NULL,
    "toLocationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "performedByUserId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transfers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "inventory_transfer_slices" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sourceLayerId" TEXT,
    "destinationLayerId" TEXT NOT NULL,
    "baseQty" INTEGER NOT NULL,
    "cost_amount" INTEGER NOT NULL,
    "unit_cost_micro" BIGINT NOT NULL,

    CONSTRAINT "inventory_transfer_slices_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "inventory_transfers_restaurantId_branchId_idx" ON "inventory_transfers"("restaurantId", "branchId");
CREATE INDEX IF NOT EXISTS "inventory_transfers_restaurantId_branchId_itemId_idx" ON "inventory_transfers"("restaurantId", "branchId", "itemId");
CREATE INDEX IF NOT EXISTS "inventory_transfers_restaurantId_branchId_occurredAt_idx" ON "inventory_transfers"("restaurantId", "branchId", "occurredAt");
CREATE INDEX IF NOT EXISTS "inventory_transfer_slices_transferId_idx" ON "inventory_transfer_slices"("transferId");

-- FK: slices cascade-delete with their transfer header.
DO $$ BEGIN
  ALTER TABLE "inventory_transfer_slices"
    ADD CONSTRAINT "inventory_transfer_slices_transferId_fkey"
    FOREIGN KEY ("transferId") REFERENCES "inventory_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
