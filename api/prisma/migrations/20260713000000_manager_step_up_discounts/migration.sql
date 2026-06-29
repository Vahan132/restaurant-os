-- Manager step-up discounts (4A): DEVICE-scoped rate-limit + lockout on failed
-- step-up authorization attempts. One row per enrolled device. No secrets are
-- stored — this is purely a throttle. Edge-local operational state (NOT synced).
--
-- NOTE: this feature reuses the EXISTING DISCOUNT_APPLY permission as the single
-- discount authority (no new capability is introduced), so there is no role
-- backfill in this migration.

-- CreateTable
CREATE TABLE "step_up_throttles" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "step_up_throttles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "step_up_throttles_deviceId_key" ON "step_up_throttles"("deviceId");

-- CreateIndex
CREATE INDEX "step_up_throttles_restaurantId_branchId_idx" ON "step_up_throttles"("restaurantId", "branchId");
