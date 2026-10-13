-- CX-1: Consumer discovery backend.
--   * Brand marketing profile on the Restaurant (i18n about, website, kill switch).
--   * Per-branch public location fields + visibility flags (the Branch is the
--     consumer "listing unit").
--   * Platform-defined attributes taxonomy + restaurant selections.
--   * Brand photo gallery + per-branch public opening hours.
-- All additive; no existing column/table is dropped or squashed.

-- ── Restaurant: brand marketing profile ──────────────────────────────────────
ALTER TABLE "restaurants" ADD COLUMN "aboutHy" TEXT;
ALTER TABLE "restaurants" ADD COLUMN "aboutRu" TEXT;
ALTER TABLE "restaurants" ADD COLUMN "aboutEn" TEXT;
ALTER TABLE "restaurants" ADD COLUMN "website" TEXT;
ALTER TABLE "restaurants" ADD COLUMN "consumerListingSuppressed" BOOLEAN NOT NULL DEFAULT false;

-- ── Branch: per-branch public location fields + visibility flags ──────────────
ALTER TABLE "branches" ADD COLUMN "publicPhone" TEXT;
ALTER TABLE "branches" ADD COLUMN "address" TEXT;
ALTER TABLE "branches" ADD COLUMN "city" TEXT;
ALTER TABLE "branches" ADD COLUMN "menuPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "branches" ADD COLUMN "reservationsPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "branches" ADD COLUMN "listedInConsumerApp" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "branches_listedInConsumerApp_idx" ON "branches"("listedInConsumerApp");

-- ── Taxonomy: AttributeCategory ──────────────────────────────────────────────
CREATE TABLE "consumer_attribute_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "labelHy" TEXT NOT NULL,
    "labelRu" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isFilterable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consumer_attribute_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consumer_attribute_categories_slug_key" ON "consumer_attribute_categories"("slug");
CREATE INDEX "consumer_attribute_categories_position_idx" ON "consumer_attribute_categories"("position");

-- ── Taxonomy: AttributeValue ─────────────────────────────────────────────────
CREATE TABLE "consumer_attribute_values" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "labelHy" TEXT NOT NULL,
    "labelRu" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consumer_attribute_values_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consumer_attribute_values_categoryId_slug_key" ON "consumer_attribute_values"("categoryId", "slug");
CREATE INDEX "consumer_attribute_values_categoryId_position_idx" ON "consumer_attribute_values"("categoryId", "position");

ALTER TABLE "consumer_attribute_values"
    ADD CONSTRAINT "consumer_attribute_values_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "consumer_attribute_categories"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Join: RestaurantAttribute ────────────────────────────────────────────────
CREATE TABLE "consumer_restaurant_attributes" (
    "restaurantId" TEXT NOT NULL,
    "attributeValueId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumer_restaurant_attributes_pkey" PRIMARY KEY ("restaurantId", "attributeValueId")
);

CREATE INDEX "consumer_restaurant_attributes_attributeValueId_idx" ON "consumer_restaurant_attributes"("attributeValueId");

ALTER TABLE "consumer_restaurant_attributes"
    ADD CONSTRAINT "consumer_restaurant_attributes_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consumer_restaurant_attributes"
    ADD CONSTRAINT "consumer_restaurant_attributes_attributeValueId_fkey"
    FOREIGN KEY ("attributeValueId") REFERENCES "consumer_attribute_values"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Brand photo gallery ──────────────────────────────────────────────────────
CREATE TABLE "consumer_restaurant_photos" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "url" TEXT NOT NULL,
    "altHy" TEXT,
    "altRu" TEXT,
    "altEn" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumer_restaurant_photos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "consumer_restaurant_photos_restaurantId_position_idx" ON "consumer_restaurant_photos"("restaurantId", "position");

ALTER TABLE "consumer_restaurant_photos"
    ADD CONSTRAINT "consumer_restaurant_photos_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Per-branch public opening hours ──────────────────────────────────────────
--   dayOfWeek 0=Mon … 6=Sun. closesAt < opensAt ⇒ the slot crosses midnight.
CREATE TABLE "consumer_branch_public_hours" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "opensAt" TEXT,
    "closesAt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consumer_branch_public_hours_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consumer_branch_public_hours_branchId_dayOfWeek_key" ON "consumer_branch_public_hours"("branchId", "dayOfWeek");

ALTER TABLE "consumer_branch_public_hours"
    ADD CONSTRAINT "consumer_branch_public_hours_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
