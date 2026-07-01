-- CX-3 — Consumer booking + saved restaurants.
--   * SavedRestaurant: a consumer's per-branch bookmark. Both FKs cascade.
--     Unique (customerAccountId, branchId) makes save idempotent; the
--     customerAccountId index serves the "my saved" list.
--   * No new reservation table — consumer bookings reuse `reservations`, stamping
--     the nullable `consumerId` (added by 20260720000000_consumer_identity).

-- CreateTable
CREATE TABLE "consumer_saved_restaurants" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumer_saved_restaurants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consumer_saved_restaurants_customerAccountId_idx" ON "consumer_saved_restaurants"("customerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "consumer_saved_restaurants_customerAccountId_branchId_key" ON "consumer_saved_restaurants"("customerAccountId", "branchId");

-- AddForeignKey
ALTER TABLE "consumer_saved_restaurants"
    ADD CONSTRAINT "consumer_saved_restaurants_customerAccountId_fkey"
    FOREIGN KEY ("customerAccountId") REFERENCES "customer_accounts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumer_saved_restaurants"
    ADD CONSTRAINT "consumer_saved_restaurants_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
