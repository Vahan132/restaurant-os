-- FIX-E: ALL-BRANCH reach as a Role capability (not implicit for any role).
-- A user whose role has allBranches=true sees/operates EVERY active branch in
-- their restaurant; staff stay branch-explicit (FIX-BR-1). Only the OWNER system
-- role is all-branch by default.

-- Add the column (default false so existing staff/custom roles stay explicit).
ALTER TABLE "roles" ADD COLUMN "allBranches" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: existing OWNER system roles get all-branch reach. System-role
-- capabilities are written only at provisioning, so pre-FIX-E OWNER rows need
-- this additive, idempotent backfill.
UPDATE "roles"
SET "allBranches" = true
WHERE "isSystem" = true
  AND "code" = 'OWNER'
  AND "allBranches" = false;
