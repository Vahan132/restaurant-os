-- Prompt 5A: historical / external sales import (NON-FISCAL, reports-only).
--
-- Structural isolation: dedicated tables with NO foreign keys into orders,
-- payments, or the inventory ledger. By construction imported sales can never
-- enter a fiscal/HDM total or deplete stock. Branch-scoped like every
-- operational entity. Idempotent + additive — safe to re-run pieces.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ImportBatchStatus" AS ENUM ('PENDING', 'COMPLETED', 'PARTIAL', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "imported_sales_batches" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "fileName" TEXT NOT NULL,
    "importedByUserId" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imported_sales_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "imported_sales" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "itemDescription" TEXT NOT NULL,
    "itemId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit_price_amount" INTEGER NOT NULL,
    "line_total_amount" INTEGER NOT NULL,
    "paymentMethod" TEXT,
    "externalReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imported_sales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "imported_sales_batches_restaurantId_idx" ON "imported_sales_batches"("restaurantId");
CREATE INDEX IF NOT EXISTS "imported_sales_batches_restaurantId_branchId_idx" ON "imported_sales_batches"("restaurantId", "branchId");
CREATE INDEX IF NOT EXISTS "imported_sales_batches_restaurantId_createdAt_idx" ON "imported_sales_batches"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "imported_sales_restaurantId_idx" ON "imported_sales"("restaurantId");
CREATE INDEX IF NOT EXISTS "imported_sales_restaurantId_branchId_idx" ON "imported_sales"("restaurantId", "branchId");
CREATE INDEX IF NOT EXISTS "imported_sales_restaurantId_occurredAt_idx" ON "imported_sales"("restaurantId", "occurredAt");
CREATE INDEX IF NOT EXISTS "imported_sales_restaurantId_branchId_occurredAt_idx" ON "imported_sales"("restaurantId", "branchId", "occurredAt");
CREATE INDEX IF NOT EXISTS "imported_sales_importBatchId_idx" ON "imported_sales"("importBatchId");

-- CreateIndex: idempotent re-import guard. NULL externalReference rows are
-- distinct in Postgres, so only rows carrying a reference are deduped.
CREATE UNIQUE INDEX IF NOT EXISTS "imported_sales_restaurantId_externalReference_key" ON "imported_sales"("restaurantId", "externalReference");

-- AddForeignKey: child sales cascade-delete with their batch. NO FK to
-- restaurants/branches/orders — isolation is structural (matches the inventory
-- ledger tables, which also carry plain tenant ids).
DO $$ BEGIN
  ALTER TABLE "imported_sales"
    ADD CONSTRAINT "imported_sales_importBatchId_fkey"
    FOREIGN KEY ("importBatchId") REFERENCES "imported_sales_batches"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Permission backfill (5A): the new SALES_IMPORT_MANAGE permission is only
-- written to system roles at provisioning, so existing OWNER/MANAGER roles need
-- this additive, idempotent backfill to use the import endpoints.
UPDATE "roles"
SET "permissions" = array_append("permissions", 'sales:import:manage')
WHERE "isSystem" = true
  AND "code" IN ('OWNER', 'MANAGER')
  AND NOT ('sales:import:manage' = ANY("permissions"));
