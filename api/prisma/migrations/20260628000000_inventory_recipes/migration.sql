-- AlterEnum: reversal movement type (existing rows untouched)
ALTER TYPE "StockMovementType" ADD VALUE 'CONSUMPTION_REVERSAL';

-- AlterTable: mark an OUT movement once reversed
ALTER TABLE "inventory_stock_movements" ADD COLUMN "reversedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "inventory_stock_movements_restaurantId_refType_refId_idx" ON "inventory_stock_movements"("restaurantId", "refType", "refId");

-- CreateTable
CREATE TABLE "inventory_recipes" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "menuItemId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "inventory_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_recipe_lines" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "baseQty" INTEGER NOT NULL,

    CONSTRAINT "inventory_recipe_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_modifier_consumptions" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "modifierOptionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "baseQty" INTEGER NOT NULL,

    CONSTRAINT "inventory_modifier_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_recipes_restaurantId_menuItemId_key" ON "inventory_recipes"("restaurantId", "menuItemId");

-- CreateIndex
CREATE INDEX "inventory_recipes_restaurantId_idx" ON "inventory_recipes"("restaurantId");

-- CreateIndex
CREATE INDEX "inventory_recipe_lines_recipeId_idx" ON "inventory_recipe_lines"("recipeId");

-- CreateIndex
CREATE INDEX "inventory_recipe_lines_itemId_idx" ON "inventory_recipe_lines"("itemId");

-- CreateIndex
CREATE INDEX "inventory_modifier_consumptions_recipeId_idx" ON "inventory_modifier_consumptions"("recipeId");

-- CreateIndex
CREATE INDEX "inventory_mod_consumption_restaurant_option_idx" ON "inventory_modifier_consumptions"("restaurantId", "modifierOptionId");

-- AddForeignKey
ALTER TABLE "inventory_recipe_lines" ADD CONSTRAINT "inventory_recipe_lines_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "inventory_recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_modifier_consumptions" ADD CONSTRAINT "inventory_modifier_consumptions_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "inventory_recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
