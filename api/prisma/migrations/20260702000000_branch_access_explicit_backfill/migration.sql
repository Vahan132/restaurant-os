-- FIX-BR-1: branch access is ALWAYS explicit (no implicit all-branch).
-- A restaurant-wide role now grants restaurant-LEVEL permissions only and no
-- longer confers operational access to every branch. Without a backfill the
-- existing owner (and any other restaurant-wide users) would be locked out of
-- every branch-scoped endpoint after this change.
--
-- Backfill: grant each existing, non-deleted, restaurant-wide user an explicit
-- BranchMembership (with their existing restaurant role) at their restaurant's
-- current default branch. Branch-scoped (sentinel) users already derive access
-- from explicit memberships and are intentionally excluded. Idempotent: skips
-- any (branch,user) pair that already has a membership.

INSERT INTO "branch_memberships" (
    "id", "restaurantId", "branchId", "userId", "roleId", "createdByUserId", "createdAt", "updatedAt"
)
SELECT
    'bm_' || md5(random()::text || clock_timestamp()::text || u."id" || b."id"),
    b."restaurantId",
    b."id",
    u."id",
    u."roleId",
    u."id",
    now(),
    now()
FROM "users" u
JOIN "roles" r ON r."id" = u."roleId"
JOIN "branches" b
    ON b."restaurantId" = u."restaurantId"
    AND b."isDefault" = true
    AND b."deletedAt" IS NULL
WHERE u."deletedAt" IS NULL
  AND u."restaurantId" IS NOT NULL
  AND r."code" <> 'BRANCH_SCOPED'
  AND NOT EXISTS (
      SELECT 1 FROM "branch_memberships" m
      WHERE m."branchId" = b."id" AND m."userId" = u."id"
  );
