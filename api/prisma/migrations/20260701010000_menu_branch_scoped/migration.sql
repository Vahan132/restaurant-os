-- BR-2: make the MENU catalog branch-owned (clone-and-diverge).
--   * add branchId (required) to menu_categories, menu_items, modifier_groups,
--     modifier_options
--   * add a stable per-branch `code` to menu_categories + menu_items
--   * backfill every row onto the restaurant's DEFAULT branch (BR-1)
--   * populate `code` from the name (slug), de-duped per (restaurant, branch)
--   * per-branch uniqueness on code; composite [restaurantId, branchId] indexes

-- ── 1. Add columns (NULLABLE first, so existing rows can be backfilled) ──────
ALTER TABLE "menu_categories" ADD COLUMN "branchId" TEXT;
ALTER TABLE "menu_categories" ADD COLUMN "code" TEXT;
ALTER TABLE "menu_items"      ADD COLUMN "branchId" TEXT;
ALTER TABLE "menu_items"      ADD COLUMN "code" TEXT;
ALTER TABLE "modifier_groups"  ADD COLUMN "branchId" TEXT;
ALTER TABLE "modifier_options" ADD COLUMN "branchId" TEXT;

-- ── 2. Backfill branchId = the restaurant's default branch ──────────────────
UPDATE "menu_categories" t SET "branchId" = b."id"
FROM "branches" b WHERE b."restaurantId" = t."restaurantId" AND b."isDefault" = true;

UPDATE "menu_items" t SET "branchId" = b."id"
FROM "branches" b WHERE b."restaurantId" = t."restaurantId" AND b."isDefault" = true;

UPDATE "modifier_groups" t SET "branchId" = b."id"
FROM "branches" b WHERE b."restaurantId" = t."restaurantId" AND b."isDefault" = true;

UPDATE "modifier_options" t SET "branchId" = b."id"
FROM "branches" b WHERE b."restaurantId" = t."restaurantId" AND b."isDefault" = true;

-- ── 3. Populate `code` from a slug of the name, de-duped per (restaurant, branch)
-- Categories.
WITH base AS (
    SELECT
        "id",
        "restaurantId",
        "branchId",
        NULLIF(trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')), '') AS slug
    FROM "menu_categories"
),
ranked AS (
    SELECT
        "id",
        COALESCE(slug, 'category') AS slug,
        ROW_NUMBER() OVER (
            PARTITION BY "restaurantId", "branchId", COALESCE(slug, 'category')
            ORDER BY "id"
        ) AS rn
    FROM base
)
UPDATE "menu_categories" t
SET "code" = CASE WHEN r.rn = 1 THEN r.slug ELSE r.slug || '-' || r.rn END
FROM ranked r WHERE t."id" = r."id";

-- Items.
WITH base AS (
    SELECT
        "id",
        "restaurantId",
        "branchId",
        NULLIF(trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')), '') AS slug
    FROM "menu_items"
),
ranked AS (
    SELECT
        "id",
        COALESCE(slug, 'item') AS slug,
        ROW_NUMBER() OVER (
            PARTITION BY "restaurantId", "branchId", COALESCE(slug, 'item')
            ORDER BY "id"
        ) AS rn
    FROM base
)
UPDATE "menu_items" t
SET "code" = CASE WHEN r.rn = 1 THEN r.slug ELSE r.slug || '-' || r.rn END
FROM ranked r WHERE t."id" = r."id";

-- ── 4. Enforce NOT NULL now that every row is populated ─────────────────────
ALTER TABLE "menu_categories" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "menu_categories" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "menu_items"      ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "menu_items"      ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "modifier_groups"  ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "modifier_options" ALTER COLUMN "branchId" SET NOT NULL;

-- ── 5. Per-branch uniqueness + composite indexes ────────────────────────────
CREATE UNIQUE INDEX "menu_categories_restaurantId_branchId_code_key"
    ON "menu_categories"("restaurantId", "branchId", "code");
CREATE UNIQUE INDEX "menu_items_restaurantId_branchId_code_key"
    ON "menu_items"("restaurantId", "branchId", "code");

CREATE INDEX "menu_categories_restaurantId_branchId_idx"
    ON "menu_categories"("restaurantId", "branchId");
CREATE INDEX "menu_items_restaurantId_branchId_idx"
    ON "menu_items"("restaurantId", "branchId");
CREATE INDEX "modifier_groups_restaurantId_branchId_idx"
    ON "modifier_groups"("restaurantId", "branchId");
CREATE INDEX "modifier_options_restaurantId_branchId_idx"
    ON "modifier_options"("restaurantId", "branchId");
