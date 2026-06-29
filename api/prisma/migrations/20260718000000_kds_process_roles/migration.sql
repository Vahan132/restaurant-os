-- Prompt 7A: seed the two new system roles (Chef, Sous-Chef) for EXISTING
-- organizations. New orgs get them automatically via SystemRoleSeeder (the
-- catalog is the single source of truth); only pre-existing orgs need this
-- additive, idempotent backfill.
--
-- Both roles are kitchen/KDS roles holding the process-run capability:
--   KDS_ACCESS, inventory:read, inventory:process:run
-- They are restaurant-wide in PERMISSIONS but NOT all-branch (allBranches=false),
-- so a Chef still operates only at branches they are a member of — matching every
-- other staff role. Defining processes (inventory:process:manage) is intentionally
-- NOT granted; that stays with OWNER/MANAGER.
--
-- Idempotent: the @@unique([organizationId, code]) guard + NOT EXISTS skip any org
-- that already has the role (safe to re-run).

INSERT INTO "roles" (
    "id", "organizationId", "name", "code", "permissions",
    "isSystem", "allBranches", "createdAt", "updatedAt"
)
SELECT
    'role_' || md5(random()::text || clock_timestamp()::text || o."id" || 'CHEF'),
    o."id",
    'Chef',
    'CHEF',
    ARRAY['KDS_ACCESS', 'inventory:read', 'inventory:process:run']::text[],
    true,
    false,
    now(),
    now()
FROM "organizations" o
WHERE NOT EXISTS (
    SELECT 1 FROM "roles" r
    WHERE r."organizationId" = o."id" AND r."code" = 'CHEF'
);

INSERT INTO "roles" (
    "id", "organizationId", "name", "code", "permissions",
    "isSystem", "allBranches", "createdAt", "updatedAt"
)
SELECT
    'role_' || md5(random()::text || clock_timestamp()::text || o."id" || 'SOUS_CHEF'),
    o."id",
    'Sous-Chef',
    'SOUS_CHEF',
    ARRAY['KDS_ACCESS', 'inventory:read', 'inventory:process:run']::text[],
    true,
    false,
    now(),
    now()
FROM "organizations" o
WHERE NOT EXISTS (
    SELECT 1 FROM "roles" r
    WHERE r."organizationId" = o."id" AND r."code" = 'SOUS_CHEF'
);
