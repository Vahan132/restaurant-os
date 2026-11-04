-- BRUTTO-1 / COST-FIFO-1 / DAILY-INV-1. All additive + nullable; safe on existing rows.

-- BRUTTO-1: recipe line netto (null = netto == brutto) + item default cleaning loss.
ALTER TABLE "inventory_recipe_lines" ADD COLUMN "netQty" INTEGER;
ALTER TABLE "inventory_items" ADD COLUMN "cleaningLossBps" INTEGER;

-- COST-FIFO-1: current-batch unit cost on the item + current dish cost on the recipe.
ALTER TABLE "inventory_items" ADD COLUMN "current_unit_cost_micro" BIGINT;
ALTER TABLE "inventory_recipes" ADD COLUMN "cost_amount" INTEGER;
ALTER TABLE "inventory_recipes" ADD COLUMN "costUpdatedAt" TIMESTAMP(3);

CREATE TABLE "inventory_item_cost_changes" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "old_unit_cost_micro" BIGINT,
    "new_unit_cost_micro" BIGINT NOT NULL,
    "layerId" TEXT,
    "supplierId" TEXT,
    "trigger" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_item_cost_changes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "inv_item_cost_change_scope_idx" ON "inventory_item_cost_changes"("restaurantId", "branchId", "occurredAt");
CREATE INDEX "inventory_item_cost_changes_itemId_occurredAt_idx" ON "inventory_item_cost_changes"("itemId", "occurredAt");

CREATE TABLE "inventory_recipe_cost_changes" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "old_cost_amount" INTEGER,
    "new_cost_amount" INTEGER NOT NULL,
    "causeItemId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_recipe_cost_changes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "inv_recipe_cost_change_scope_idx" ON "inventory_recipe_cost_changes"("restaurantId", "branchId", "occurredAt");
CREATE INDEX "inventory_recipe_cost_changes_recipeId_occurredAt_idx" ON "inventory_recipe_cost_changes"("recipeId", "occurredAt");

-- DAILY-INV-1: frozen end-of-day inventory report per (branch, business day).
CREATE TABLE "inventory_daily_reports" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "businessDate" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_daily_reports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "inv_daily_report_branch_date_key" ON "inventory_daily_reports"("branchId", "businessDate");
CREATE INDEX "inventory_daily_reports_restaurantId_branchId_businessDate_idx" ON "inventory_daily_reports"("restaurantId", "branchId", "businessDate");
