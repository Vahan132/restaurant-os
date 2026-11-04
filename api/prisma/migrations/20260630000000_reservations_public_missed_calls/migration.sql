-- R-API-1: reservations extension — public booking source, missed-call ingestion + call devices.

-- CreateEnum
CREATE TYPE "ReservationSource" AS ENUM ('STAFF', 'PUBLIC', 'PHONE');

-- CreateEnum
CREATE TYPE "MissedCallStatus" AS ENUM ('NEW', 'HANDLED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "CallDeviceStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- AlterTable: reservation source + optional customer note.
-- DEFAULT 'STAFF' backfills every existing reservation row (idempotent).
ALTER TABLE "reservations" ADD COLUMN "source" "ReservationSource" NOT NULL DEFAULT 'STAFF';
ALTER TABLE "reservations" ADD COLUMN "customerNote" TEXT;

-- CreateTable
CREATE TABLE "call_devices" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "CallDeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSeenAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missed_calls" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "deviceId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "callerName" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "status" "MissedCallStatus" NOT NULL DEFAULT 'NEW',
    "handledByUserId" TEXT,
    "linkedReservationId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "missed_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "call_devices_tokenHash_key" ON "call_devices"("tokenHash");

-- CreateIndex
CREATE INDEX "call_devices_restaurantId_idx" ON "call_devices"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "missed_calls_restaurantId_dedupeKey_key" ON "missed_calls"("restaurantId", "dedupeKey");

-- CreateIndex
CREATE INDEX "missed_calls_restaurantId_status_occurredAt_idx" ON "missed_calls"("restaurantId", "status", "occurredAt");

-- CreateIndex
CREATE INDEX "missed_calls_deviceId_idx" ON "missed_calls"("deviceId");

-- AddForeignKey
ALTER TABLE "call_devices" ADD CONSTRAINT "call_devices_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missed_calls" ADD CONSTRAINT "missed_calls_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missed_calls" ADD CONSTRAINT "missed_calls_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "call_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
