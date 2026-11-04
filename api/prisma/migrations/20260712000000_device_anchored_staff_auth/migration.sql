-- Device-anchored staff auth (3A, cloud path): enrolled devices, staff PINs,
-- per-branch IP policy, and the restaurant-level unanchored-admin-login toggle.

-- CreateEnum
CREATE TYPE "BranchIpBindingMode" AS ENUM ('STRICT', 'SOFT');

-- CreateEnum
CREATE TYPE "DeviceSurface" AS ENUM ('POS', 'KDS', 'ADMIN');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "StaffPinStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- AlterTable: per-branch IP policy. Defaults backfill every existing branch
-- (SOFT + empty allowlist => IP never blocks until a manager opts into STRICT).
ALTER TABLE "branches" ADD COLUMN "ipBindingMode" "BranchIpBindingMode" NOT NULL DEFAULT 'SOFT';
ALTER TABLE "branches" ADD COLUMN "ipAllowlist" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable: restaurant-level admin-login anchoring toggle. DEFAULT false
-- backfills every existing restaurant (admin login anchored by default).
ALTER TABLE "restaurant_settings" ADD COLUMN "allowUnanchoredAdminLogin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "surface" "DeviceSurface" NOT NULL,
    "deviceSecretHash" TEXT NOT NULL,
    "enrolledByUserId" TEXT NOT NULL,
    "enrolledIp" TEXT,
    "enrolledCidr" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSeenAt" TIMESTAMP(3),
    "lastSeenIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_pins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "pinFingerprint" TEXT,
    "status" "StaffPinStatus" NOT NULL DEFAULT 'ACTIVE',
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "mustRotate" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "devices_deviceSecretHash_key" ON "devices"("deviceSecretHash");

-- CreateIndex
CREATE INDEX "devices_restaurantId_branchId_idx" ON "devices"("restaurantId", "branchId");

-- CreateIndex
CREATE INDEX "devices_restaurantId_branchId_surface_status_idx" ON "devices"("restaurantId", "branchId", "surface", "status");

-- CreateIndex
CREATE UNIQUE INDEX "staff_pins_userId_key" ON "staff_pins"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_pins_restaurantId_pinFingerprint_key" ON "staff_pins"("restaurantId", "pinFingerprint");

-- CreateIndex
CREATE INDEX "staff_pins_restaurantId_idx" ON "staff_pins"("restaurantId");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_pins" ADD CONSTRAINT "staff_pins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill the two new capabilities onto existing system roles. System-role
-- permissions are written only at provisioning, so pre-existing OWNER/MANAGER
-- rows need this additive, idempotent backfill (OWNER + MANAGER hold ALL perms).
UPDATE "roles"
SET "permissions" = array_append("permissions", 'device.enroll')
WHERE "isSystem" = true
  AND "code" IN ('OWNER', 'MANAGER')
  AND NOT ('device.enroll' = ANY("permissions"));

UPDATE "roles"
SET "permissions" = array_append("permissions", 'staff.pin.manage')
WHERE "isSystem" = true
  AND "code" IN ('OWNER', 'MANAGER')
  AND NOT ('staff.pin.manage' = ANY("permissions"));
