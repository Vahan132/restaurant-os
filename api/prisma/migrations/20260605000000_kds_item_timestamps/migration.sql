-- Prompt 8 (KDS): per-item kitchen timestamps.

-- AlterTable
ALTER TABLE "order_items"
    ADD COLUMN "preparingAt" TIMESTAMP(3),
    ADD COLUMN "readyAt" TIMESTAMP(3);
