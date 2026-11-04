-- AlterEnum: add process movement types (existing rows untouched)
ALTER TYPE "StockMovementType" ADD VALUE 'PROCESS_OUT';
ALTER TYPE "StockMovementType" ADD VALUE 'PROCESS_IN';

-- CreateEnum
CREATE TYPE "ProcessStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "inventory_processes" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "processing_cost_amount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "status" "ProcessStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "inventory_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_process_inputs" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "baseQty" INTEGER NOT NULL,

    CONSTRAINT "inventory_process_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_process_outputs" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "baseQty" INTEGER NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "costShareBps" INTEGER,

    CONSTRAINT "inventory_process_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_process_runs" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "processId" TEXT NOT NULL,
    "multiplier" INTEGER NOT NULL DEFAULT 1,
    "input_cost_amount" INTEGER NOT NULL,
    "processing_cost_amount" INTEGER NOT NULL,
    "total_cost_amount" INTEGER NOT NULL,
    "wentNegative" BOOLEAN NOT NULL DEFAULT false,
    "runAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_process_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_processes_restaurantId_idx" ON "inventory_processes"("restaurantId");

-- CreateIndex
CREATE INDEX "inventory_process_inputs_processId_idx" ON "inventory_process_inputs"("processId");

-- CreateIndex
CREATE INDEX "inventory_process_inputs_itemId_idx" ON "inventory_process_inputs"("itemId");

-- CreateIndex
CREATE INDEX "inventory_process_outputs_processId_idx" ON "inventory_process_outputs"("processId");

-- CreateIndex
CREATE INDEX "inventory_process_outputs_itemId_idx" ON "inventory_process_outputs"("itemId");

-- CreateIndex
CREATE INDEX "inventory_process_runs_restaurantId_processId_runAt_idx" ON "inventory_process_runs"("restaurantId", "processId", "runAt");

-- AddForeignKey
ALTER TABLE "inventory_process_inputs" ADD CONSTRAINT "inventory_process_inputs_processId_fkey" FOREIGN KEY ("processId") REFERENCES "inventory_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_process_outputs" ADD CONSTRAINT "inventory_process_outputs_processId_fkey" FOREIGN KEY ("processId") REFERENCES "inventory_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
