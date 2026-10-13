-- BR-5: make reservations, missed calls, and call devices branch-scoped.
-- KDS has no persisted ticket table (tickets are derived from branch-owned order
-- lines), so no KDS schema change. Existing rows land on the restaurant's DEFAULT
-- branch, consistent with the default-branch orders from BR-4.

-- ── Backfill the existing nullable branchId to the default branch ────────────
UPDATE "reservations" t SET "branchId" = b."id" FROM "branches" b WHERE b."restaurantId" = t."restaurantId" AND b."isDefault" = true AND t."branchId" IS NULL;
UPDATE "missed_calls" t  SET "branchId" = b."id" FROM "branches" b WHERE b."restaurantId" = t."restaurantId" AND b."isDefault" = true AND t."branchId" IS NULL;
UPDATE "call_devices" t  SET "branchId" = b."id" FROM "branches" b WHERE b."restaurantId" = t."restaurantId" AND b."isDefault" = true AND t."branchId" IS NULL;

-- ── Enforce NOT NULL ────────────────────────────────────────────────────────
ALTER TABLE "reservations" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "missed_calls"  ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "call_devices"  ALTER COLUMN "branchId" SET NOT NULL;

-- ── Branch-scoped indexes ───────────────────────────────────────────────────
CREATE INDEX "reservations_restaurantId_branchId_reservedAt_idx" ON "reservations"("restaurantId", "branchId", "reservedAt");
CREATE INDEX "missed_calls_restaurantId_branchId_status_occurredAt_idx" ON "missed_calls"("restaurantId", "branchId", "status", "occurredAt");
CREATE INDEX "call_devices_restaurantId_branchId_idx" ON "call_devices"("restaurantId", "branchId");
