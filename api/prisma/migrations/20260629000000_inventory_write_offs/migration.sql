-- CreateEnum
CREATE TYPE "WriteOffReason" AS ENUM ('STAFF_MEAL', 'SPOILAGE', 'WASTE', 'BREAKAGE', 'THEFT', 'OTHER');

-- CreateEnum
CREATE TYPE "WriteOffLineKind" AS ENUM ('ITEM', 'DISH');

-- CreateTable
CREATE TABLE "inventory_write_offs" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "reason" "WriteOffReason" NOT NULL,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_write_offs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_write_off_lines" (
    "id" TEXT NOT NULL,
    "writeOffId" TEXT NOT NULL,
    "kind" "WriteOffLineKind" NOT NULL,
    "itemId" TEXT,
    "menuItemId" TEXT,
    "enteredUnit" TEXT,
    "enteredQty" INTEGER,
    "baseQty" INTEGER,
    "units" INTEGER,
    "modifierOptionIds" JSONB,
    "cost_amount" INTEGER NOT NULL,

    CONSTRAINT "inventory_write_off_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_write_offs_restaurantId_occurredAt_idx" ON "inventory_write_offs"("restaurantId", "occurredAt");

-- CreateIndex
CREATE INDEX "inventory_write_offs_restaurantId_reason_occurredAt_idx" ON "inventory_write_offs"("restaurantId", "reason", "occurredAt");

-- CreateIndex
CREATE INDEX "inventory_write_off_lines_writeOffId_idx" ON "inventory_write_off_lines"("writeOffId");

-- AddForeignKey
ALTER TABLE "inventory_write_off_lines" ADD CONSTRAINT "inventory_write_off_lines_writeOffId_fkey" FOREIGN KEY ("writeOffId") REFERENCES "inventory_write_offs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
