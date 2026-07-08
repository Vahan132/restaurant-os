-- CATALOG-1 — Platform catalog foundation (ADR §2–§4, §10).
--   * Platform-OWNED, NOT tenant-scoped (no org/restaurant/branch column, global
--     slug unique): allergen taxonomy, catalog categories, catalog items
--     (multilingual + default adgCode), and the item↔allergen join. Mirrors the
--     consumer AttributeCategory/Value taxonomy shape.
--   * inventory_items gains adoption + per-branch override columns — all additive +
--     nullable, so every existing row stays valid (catalogItemId NULL = a custom,
--     uncatalogued item). `catalogItemId` is a PLAIN scalar with NO foreign key to
--     catalog_items: it matches the cross-aggregate style used across inventory AND
--     enforces ADR §4 (the platform catalog has no path back to tenant inventory).

-- CreateTable
CREATE TABLE "catalog_allergens" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "labelHy" TEXT NOT NULL,
    "labelRu" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_allergens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "labelHy" TEXT NOT NULL,
    "labelRu" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_items" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameHy" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "categoryId" TEXT,
    "adg_code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_item_allergens" (
    "catalogItemId" TEXT NOT NULL,
    "allergenId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_item_allergens_pkey" PRIMARY KEY ("catalogItemId","allergenId")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalog_allergens_slug_key" ON "catalog_allergens"("slug");

-- CreateIndex
CREATE INDEX "catalog_allergens_position_idx" ON "catalog_allergens"("position");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_categories_slug_key" ON "catalog_categories"("slug");

-- CreateIndex
CREATE INDEX "catalog_categories_position_idx" ON "catalog_categories"("position");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_items_slug_key" ON "catalog_items"("slug");

-- CreateIndex
CREATE INDEX "catalog_items_categoryId_idx" ON "catalog_items"("categoryId");

-- CreateIndex
CREATE INDEX "catalog_item_allergens_allergenId_idx" ON "catalog_item_allergens"("allergenId");

-- AddForeignKey
ALTER TABLE "catalog_items"
    ADD CONSTRAINT "catalog_items_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "catalog_categories"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_item_allergens"
    ADD CONSTRAINT "catalog_item_allergens_catalogItemId_fkey"
    FOREIGN KEY ("catalogItemId") REFERENCES "catalog_items"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_item_allergens"
    ADD CONSTRAINT "catalog_item_allergens_allergenId_fkey"
    FOREIGN KEY ("allergenId") REFERENCES "catalog_allergens"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable (inventory_items — additive, nullable; NO FK to catalog_items by design)
ALTER TABLE "inventory_items" ADD COLUMN "catalogItemId" TEXT;
ALTER TABLE "inventory_items" ADD COLUMN "allergen_override" JSONB;
ALTER TABLE "inventory_items" ADD COLUMN "adg_code_override" TEXT;

-- CreateIndex
CREATE INDEX "inventory_items_catalogItemId_idx" ON "inventory_items"("catalogItemId");
