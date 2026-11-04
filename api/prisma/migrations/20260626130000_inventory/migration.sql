-- CreateEnum
CREATE TYPE "ItemKind" AS ENUM ('RAW', 'PROCESSED');

-- CreateEnum
CREATE TYPE "InventoryBaseUnit" AS ENUM ('GRAM', 'MILLILITER', 'PIECE');

-- CreateEnum
CREATE TYPE "InventoryItemStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "StockLayerStatus" AS ENUM ('OPEN', 'DEPLETED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('RECEIPT_IN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'CONSUMPTION_OUT', 'WRITE_OFF_OUT');

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "categoryId" TEXT,
    "kind" "ItemKind" NOT NULL DEFAULT 'RAW',
    "baseUnit" "InventoryBaseUnit" NOT NULL,
    "alternateUnits" JSONB NOT NULL DEFAULT '[]',
    "trackExpiry" BOOLEAN NOT NULL DEFAULT false,
    "lowStockThresholdBase" INTEGER,
    "last_unit_cost_micro" BIGINT,
    "status" "InventoryItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_categories" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_suppliers" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "inventory_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_goods_receipts" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "supplierId" TEXT,
    "reference" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_goods_receipt_lines" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "enteredUnit" TEXT NOT NULL,
    "enteredQty" INTEGER NOT NULL,
    "baseQty" INTEGER NOT NULL,
    "line_total_cost_amount" INTEGER NOT NULL,
    "expiryDate" TIMESTAMP(3),

    CONSTRAINT "inventory_goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stock_layers" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "itemId" TEXT NOT NULL,
    "sourceReceiptLineId" TEXT,
    "baseQtyReceived" INTEGER NOT NULL,
    "baseQtyRemaining" INTEGER NOT NULL,
    "line_total_cost_amount" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "status" "StockLayerStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_stock_layers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stock_movements" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "itemId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "baseQty" INTEGER NOT NULL,
    "cost_amount" INTEGER NOT NULL,
    "layerId" TEXT,
    "reason" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_items_restaurantId_idx" ON "inventory_items"("restaurantId");

-- CreateIndex
CREATE INDEX "inventory_items_branchId_idx" ON "inventory_items"("branchId");

-- CreateIndex
CREATE INDEX "inventory_items_restaurantId_categoryId_idx" ON "inventory_items"("restaurantId", "categoryId");

-- CreateIndex
CREATE INDEX "inventory_categories_restaurantId_idx" ON "inventory_categories"("restaurantId");

-- CreateIndex
CREATE INDEX "inventory_suppliers_restaurantId_idx" ON "inventory_suppliers"("restaurantId");

-- CreateIndex
CREATE INDEX "inventory_goods_receipts_restaurantId_idx" ON "inventory_goods_receipts"("restaurantId");

-- CreateIndex
CREATE INDEX "inventory_goods_receipts_branchId_idx" ON "inventory_goods_receipts"("branchId");

-- CreateIndex
CREATE INDEX "inventory_goods_receipts_supplierId_idx" ON "inventory_goods_receipts"("supplierId");

-- CreateIndex
CREATE INDEX "inventory_goods_receipts_restaurantId_receivedAt_idx" ON "inventory_goods_receipts"("restaurantId", "receivedAt");

-- CreateIndex
CREATE INDEX "inventory_goods_receipt_lines_receiptId_idx" ON "inventory_goods_receipt_lines"("receiptId");

-- CreateIndex
CREATE INDEX "inventory_goods_receipt_lines_itemId_idx" ON "inventory_goods_receipt_lines"("itemId");

-- CreateIndex
CREATE INDEX "inventory_stock_layers_restaurantId_itemId_receivedAt_idx" ON "inventory_stock_layers"("restaurantId", "itemId", "receivedAt");

-- CreateIndex
CREATE INDEX "inventory_stock_layers_restaurantId_itemId_expiryDate_idx" ON "inventory_stock_layers"("restaurantId", "itemId", "expiryDate");

-- CreateIndex
CREATE INDEX "inventory_stock_layers_restaurantId_itemId_status_idx" ON "inventory_stock_layers"("restaurantId", "itemId", "status");

-- CreateIndex
CREATE INDEX "inventory_stock_movements_restaurantId_itemId_occurredAt_idx" ON "inventory_stock_movements"("restaurantId", "itemId", "occurredAt");

-- CreateIndex
CREATE INDEX "inventory_stock_movements_restaurantId_type_occurredAt_idx" ON "inventory_stock_movements"("restaurantId", "type", "occurredAt");

-- AddForeignKey
ALTER TABLE "inventory_goods_receipt_lines" ADD CONSTRAINT "inventory_goods_receipt_lines_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "inventory_goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
