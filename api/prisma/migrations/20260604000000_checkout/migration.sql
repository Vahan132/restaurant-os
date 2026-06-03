-- Prompt 7: checkout (manual payments, close, split, receipt). NO TAX.

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentState" AS ENUM ('ACTIVE', 'VOIDED');

-- AlterTable
ALTER TABLE "orders"
    ADD COLUMN "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    ADD COLUMN "paid_amount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "split_from_order_id" TEXT;

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" INTEGER NOT NULL,
    "tendered_amount" INTEGER,
    "state" "PaymentState" NOT NULL DEFAULT 'ACTIVE',
    "processedByUserId" TEXT NOT NULL,
    "voidedByUserId" TEXT,
    "voidedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");

-- CreateIndex
CREATE INDEX "payments_restaurantId_idx" ON "payments"("restaurantId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
