-- ORDER-4 — App prepayment ordering.
--   * Order gains a nullable consumerId FK (SetNull) binding an app-placed order
--     to the CX-2 consumer who placed it. Additive + nullable: every existing
--     order and all QR-web/staff orders remain valid with NULL. SetNull so
--     deleting a CustomerAccount severs the link without deleting order history.
--     Mirrors reservations.consumerId (20260720000000_consumer_identity).
--   * No behavior change to QR-web ordering; the app path is the only writer.

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "consumerId" TEXT;

-- CreateIndex
CREATE INDEX "orders_consumerId_idx" ON "orders"("consumerId");

-- AddForeignKey
ALTER TABLE "orders"
    ADD CONSTRAINT "orders_consumerId_fkey"
    FOREIGN KEY ("consumerId") REFERENCES "customer_accounts"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
