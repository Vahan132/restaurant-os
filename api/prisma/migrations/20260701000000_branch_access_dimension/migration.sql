-- BR-1: activate Branch as an ACCESS dimension.
--   * Branch.isDefault (exactly one default per restaurant)
--   * branch_memberships (a user's role at a specific branch)
--   * backfill: exactly one default branch per restaurant (create one if missing)
--   * backfill: BRANCH_MANAGE onto existing OWNER/MANAGER system roles
--   * seed: the BRANCH_SCOPED sentinel role for every existing organization
-- No operational/catalog data is moved here (that is BR-2/BR-3).

-- ── Branch.isDefault ────────────────────────────────────────────────────────
ALTER TABLE "branches" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- ── branch_memberships ──────────────────────────────────────────────────────
CREATE TABLE "branch_memberships" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branch_memberships_branchId_userId_key" ON "branch_memberships"("branchId", "userId");
CREATE INDEX "branch_memberships_restaurantId_userId_idx" ON "branch_memberships"("restaurantId", "userId");
CREATE INDEX "branch_memberships_branchId_idx" ON "branch_memberships"("branchId");

-- AddForeignKey
ALTER TABLE "branch_memberships"
    ADD CONSTRAINT "branch_memberships_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "branch_memberships"
    ADD CONSTRAINT "branch_memberships_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Backfill: exactly one default branch per restaurant ─────────────────────
-- 1) Mark the earliest-created non-deleted branch of each restaurant as default.
WITH ranked AS (
    SELECT "id",
           ROW_NUMBER() OVER (PARTITION BY "restaurantId" ORDER BY "createdAt" ASC, "id" ASC) AS rn
    FROM "branches"
    WHERE "deletedAt" IS NULL
)
UPDATE "branches" b
SET "isDefault" = true
FROM ranked r
WHERE b."id" = r."id" AND r.rn = 1;

-- 2) Create a default branch for any non-deleted restaurant that has none.
INSERT INTO "branches" ("id", "restaurantId", "name", "isDefault", "status", "createdAt", "updatedAt")
SELECT
    'br_' || md5(random()::text || clock_timestamp()::text || rest."id"),
    rest."id",
    'Main Branch',
    true,
    'ACTIVE',
    now(),
    now()
FROM "restaurants" rest
WHERE rest."deletedAt" IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM "branches" b
      WHERE b."restaurantId" = rest."id" AND b."deletedAt" IS NULL
  );

-- ── Backfill: BRANCH_MANAGE onto existing OWNER/MANAGER system roles ─────────
-- System-role permission sets are written only at provisioning, so pre-BR-1
-- roles need this additive, idempotent backfill to use the new endpoints.
UPDATE "roles"
SET "permissions" = array_append("permissions", 'BRANCH_MANAGE')
WHERE "isSystem" = true
  AND "code" IN ('OWNER', 'MANAGER')
  AND NOT ('BRANCH_MANAGE' = ANY("permissions"));

-- ── Seed: the BRANCH_SCOPED sentinel role for every organization ─────────────
-- Empty permission set; assigning it to a user marks them branch-scoped.
INSERT INTO "roles" ("id", "organizationId", "name", "code", "permissions", "isSystem", "createdAt", "updatedAt")
SELECT
    'role_' || md5(random()::text || clock_timestamp()::text || o."id"),
    o."id",
    'Branch-Scoped (no restaurant-wide access)',
    'BRANCH_SCOPED',
    ARRAY[]::TEXT[],
    true,
    now(),
    now()
FROM "organizations" o
WHERE NOT EXISTS (
    SELECT 1 FROM "roles" r
    WHERE r."organizationId" = o."id" AND r."code" = 'BRANCH_SCOPED'
);
