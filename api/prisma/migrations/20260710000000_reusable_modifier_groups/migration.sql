-- Prompt 1A: reusable modifier groups.
--
-- Modifier groups stop being owned by a single dish (`modifier_groups.menuItemId`)
-- and become a reusable, restaurant+branch-scoped library attached to dishes
-- many-to-many via the new `dish_modifier_groups` join (with optional per-attachment
-- overrides). Modifier options rename `displayOrder` -> `sortOrder` and gain
-- `isDefault`. Modifier groups gain `status` and drop `displayOrder`.
--
-- MIGRATION + DEDUPE STRATEGY (idempotent against a fresh deploy; lossless):
--   * Each existing modifier_groups row today belongs to exactly ONE dish
--     (the old 1:N `menuItemId`). We back-fill exactly ONE attachment per existing
--     non-deleted group, linking it to its originating dish. The attachment's
--     sortOrder inherits the group's old displayOrder; all overrides are NULL
--     (= inherit the group value).
--   * NO cross-dish dedupe/merge is performed. Because every group is currently
--     owned by a single dish there is no real sharing yet, and merging groups that
--     merely look identical across dishes risks collapsing distinct sets. Per the
--     spec we prefer one group per existing set over a risky merge. (Operators can
--     consolidate later via the new attach endpoints.)
--   * Soft-deleted groups are intentionally NOT attached (they were already removed
--     from their dish); the rows are left untouched.

-- ── 1. New join table: dish_modifier_groups ─────────────────────────────────
CREATE TABLE "dish_modifier_groups" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,
    "requiredOverride" BOOLEAN,
    "minOverride" INTEGER,
    "maxOverride" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dish_modifier_groups_pkey" PRIMARY KEY ("id")
);

-- ── 2. modifier_options: rename displayOrder -> sortOrder, add isDefault ─────
ALTER TABLE "modifier_options" RENAME COLUMN "displayOrder" TO "sortOrder";
ALTER TABLE "modifier_options" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- ── 3. modifier_groups: add status (decoupled library entity) ───────────────
ALTER TABLE "modifier_groups" ADD COLUMN "status" "MenuStatus" NOT NULL DEFAULT 'ACTIVE';

-- ── 4. Back-fill one attachment per existing non-deleted group ──────────────
INSERT INTO "dish_modifier_groups"
    ("id", "restaurantId", "branchId", "menuItemId", "modifierGroupId", "sortOrder", "createdAt", "updatedAt")
SELECT
    'dmg_' || md5(random()::text || clock_timestamp()::text || g."id"),
    g."restaurantId",
    g."branchId",
    g."menuItemId",
    g."id",
    g."displayOrder",
    g."createdAt",
    g."updatedAt"
FROM "modifier_groups" g
WHERE g."deletedAt" IS NULL;

-- ── 5. modifier_groups: drop the now-obsolete per-dish ownership ────────────
ALTER TABLE "modifier_groups" DROP CONSTRAINT "modifier_groups_menuItemId_fkey";
DROP INDEX "modifier_groups_menuItemId_idx";
ALTER TABLE "modifier_groups" DROP COLUMN "menuItemId";
ALTER TABLE "modifier_groups" DROP COLUMN "displayOrder";

-- ── 6. Indexes + foreign keys for dish_modifier_groups ──────────────────────
CREATE UNIQUE INDEX "dish_modifier_groups_menuItemId_modifierGroupId_key"
    ON "dish_modifier_groups"("menuItemId", "modifierGroupId");
CREATE INDEX "dish_modifier_groups_restaurantId_idx"
    ON "dish_modifier_groups"("restaurantId");
CREATE INDEX "dish_modifier_groups_restaurantId_branchId_idx"
    ON "dish_modifier_groups"("restaurantId", "branchId");
CREATE INDEX "dish_modifier_groups_menuItemId_idx"
    ON "dish_modifier_groups"("menuItemId");
CREATE INDEX "dish_modifier_groups_modifierGroupId_idx"
    ON "dish_modifier_groups"("modifierGroupId");

ALTER TABLE "dish_modifier_groups" ADD CONSTRAINT "dish_modifier_groups_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dish_modifier_groups" ADD CONSTRAINT "dish_modifier_groups_menuItemId_fkey"
    FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dish_modifier_groups" ADD CONSTRAINT "dish_modifier_groups_modifierGroupId_fkey"
    FOREIGN KEY ("modifierGroupId") REFERENCES "modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
