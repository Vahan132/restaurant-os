-- CATALOG-2 — archive (soft-delete) support for platform catalog items.
--   Additive + safe on existing rows: `status` defaults to ACTIVE, `deletedAt` is
--   nullable. A hard delete would strand tenant InventoryItem.catalogItemId
--   references (a plain scalar, no FK), so curation archives instead. Existing
--   tenant references keep resolving — getResolution ignores status.

-- CreateEnum
CREATE TYPE "CatalogItemStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "catalog_items" ADD COLUMN "status" "CatalogItemStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "catalog_items" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "catalog_items_status_idx" ON "catalog_items"("status");
