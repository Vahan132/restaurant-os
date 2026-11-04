-- BR-9: public-facing, per-restaurant unique Branch.slug (QR menu + public
-- booking URLs). Add as nullable, backfill from the branch name, then enforce
-- NOT NULL + a unique-per-restaurant index.

ALTER TABLE "branches" ADD COLUMN "slug" TEXT;

-- Backfill: slugify the name (lower, non-alphanumerics -> '-', trim '-').
-- The DEFAULT branch (then earliest-created) wins the clean base slug; later
-- collisions within the same restaurant get a -2/-3 suffix. Empty slugs (names
-- with no alphanumerics) fall back to 'branch'.
WITH ranked AS (
  SELECT
    "id",
    regexp_replace(
      regexp_replace(lower(coalesce(nullif(btrim("name"), ''), 'branch')), '[^a-z0-9]+', '-', 'g'),
      '(^-+|-+$)', '', 'g'
    ) AS base,
    ROW_NUMBER() OVER (
      PARTITION BY "restaurantId",
        regexp_replace(
          regexp_replace(lower(coalesce(nullif(btrim("name"), ''), 'branch')), '[^a-z0-9]+', '-', 'g'),
          '(^-+|-+$)', '', 'g'
        )
      ORDER BY "isDefault" DESC, "createdAt" ASC, "id" ASC
    ) AS rn
  FROM "branches"
)
UPDATE "branches" b
SET "slug" = CASE
  WHEN NULLIF(r.base, '') IS NULL THEN 'branch' || CASE WHEN r.rn = 1 THEN '' ELSE '-' || r.rn::text END
  WHEN r.rn = 1 THEN r.base
  ELSE r.base || '-' || r.rn::text
END
FROM ranked r
WHERE b."id" = r."id";

ALTER TABLE "branches" ALTER COLUMN "slug" SET NOT NULL;

-- Unique per restaurant (matches Prisma @@unique([restaurantId, slug])).
CREATE UNIQUE INDEX "branches_restaurantId_slug_key" ON "branches"("restaurantId", "slug");
