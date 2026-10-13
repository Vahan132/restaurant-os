-- BR-3: make the INVENTORY context branch-owned. Every inventory table carries a
-- required branchId; existing rows land on the restaurant's DEFAULT branch (BR-1),
-- matching the (now default-branch) menu + recipes so all data stays consistent.
-- InventoryItem.sku becomes unique per (restaurantId, branchId).

-- ── 1. Add branchId (NULLABLE first) to tables that lack it ──────────────────
ALTER TABLE "inventory_categories"           ADD COLUMN "branchId" TEXT;
ALTER TABLE "inventory_suppliers"            ADD COLUMN "branchId" TEXT;
ALTER TABLE "inventory_goods_receipt_lines"  ADD COLUMN "branchId" TEXT;
ALTER TABLE "inventory_process_inputs"       ADD COLUMN "branchId" TEXT;
ALTER TABLE "inventory_process_outputs"      ADD COLUMN "branchId" TEXT;
ALTER TABLE "inventory_recipe_lines"         ADD COLUMN "branchId" TEXT;
ALTER TABLE "inventory_modifier_consumptions" ADD COLUMN "branchId" TEXT;
ALTER TABLE "inventory_write_off_lines"      ADD COLUMN "branchId" TEXT;

-- ── 2a. Backfill restaurant-scoped tables → the restaurant's default branch ──
UPDATE "inventory_items" t            SET "branchId" = b."id" FROM "branches" b WHERE b."restaurantId" = t."restaurantId" AND b."isDefault" = true AND t."branchId" IS NULL;
UPDATE "inventory_categories" t       SET "branchId" = b."id" FROM "branches" b WHERE b."restaurantId" = t."restaurantId" AND b."isDefault" = true;
UPDATE "inventory_suppliers" t        SET "branchId" = b."id" FROM "branches" b WHERE b."restaurantId" = t."restaurantId" AND b."isDefault" = true;
UPDATE "inventory_goods_receipts" t   SET "branchId" = b."id" FROM "branches" b WHERE b."restaurantId" = t."restaurantId" AND b."isDefault" = true AND t."branchId" IS NULL;
UPDATE "inventory_processes" t        SET "branchId" = b."id" FROM "branches" b WHERE b."restaurantId" = t."restaurantId" AND b."isDefault" = true AND t."branchId" IS NULL;
UPDATE "inventory_process_runs" t     SET "branchId" = b."id" FROM "branches" b WHERE b."restaurantId" = t."restaurantId" AND b."isDefault" = true AND t."branchId" IS NULL;
UPDATE "inventory_recipes" t          SET "branchId" = b."id" FROM "branches" b WHERE b."restaurantId" = t."restaurantId" AND b."isDefault" = true AND t."branchId" IS NULL;
UPDATE "inventory_write_offs" t       SET "branchId" = b."id" FROM "branches" b WHERE b."restaurantId" = t."restaurantId" AND b."isDefault" = true AND t."branchId" IS NULL;
UPDATE "inventory_modifier_consumptions" t SET "branchId" = b."id" FROM "branches" b WHERE b."restaurantId" = t."restaurantId" AND b."isDefault" = true;

-- ── 2b. Stock follows the ITEM: layer/movement branch = the item's branch ────
UPDATE "inventory_stock_layers" t   SET "branchId" = i."branchId" FROM "inventory_items" i WHERE i."id" = t."itemId";
UPDATE "inventory_stock_movements" t SET "branchId" = i."branchId" FROM "inventory_items" i WHERE i."id" = t."itemId";

-- ── 2c. Backfill line/child tables from their parent ────────────────────────
UPDATE "inventory_goods_receipt_lines" l SET "branchId" = p."branchId" FROM "inventory_goods_receipts" p WHERE p."id" = l."receiptId";
UPDATE "inventory_process_inputs" l      SET "branchId" = p."branchId" FROM "inventory_processes" p WHERE p."id" = l."processId";
UPDATE "inventory_process_outputs" l     SET "branchId" = p."branchId" FROM "inventory_processes" p WHERE p."id" = l."processId";
UPDATE "inventory_recipe_lines" l        SET "branchId" = p."branchId" FROM "inventory_recipes" p WHERE p."id" = l."recipeId";
UPDATE "inventory_write_off_lines" l     SET "branchId" = p."branchId" FROM "inventory_write_offs" p WHERE p."id" = l."writeOffId";

-- ── 3. De-dup non-null sku per (restaurantId, branchId) before the unique idx ─
WITH d AS (
    SELECT "id",
           ROW_NUMBER() OVER (
               PARTITION BY "restaurantId", "branchId", "sku"
               ORDER BY "createdAt", "id"
           ) AS rn
    FROM "inventory_items"
    WHERE "sku" IS NOT NULL
)
UPDATE "inventory_items" i
SET "sku" = i."sku" || '-' || d.rn
FROM d WHERE i."id" = d."id" AND d.rn > 1;

-- ── 4. Enforce NOT NULL on every branchId now that all rows are populated ────
ALTER TABLE "inventory_items"                ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "inventory_categories"           ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "inventory_suppliers"            ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "inventory_goods_receipts"       ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "inventory_goods_receipt_lines"  ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "inventory_stock_layers"         ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "inventory_stock_movements"      ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "inventory_processes"            ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "inventory_process_inputs"       ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "inventory_process_outputs"      ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "inventory_process_runs"         ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "inventory_recipes"              ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "inventory_recipe_lines"         ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "inventory_modifier_consumptions" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "inventory_write_offs"           ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "inventory_write_off_lines"      ALTER COLUMN "branchId" SET NOT NULL;

-- ── 5. Per-branch sku uniqueness (NULL skus stay distinct in Postgres) ───────
CREATE UNIQUE INDEX "inventory_items_restaurantId_branchId_sku_key"
    ON "inventory_items"("restaurantId", "branchId", "sku");

-- ── 6. Branch-scoped indexes (added alongside the existing item-centric ones) ─
CREATE INDEX "inventory_items_restaurantId_branchId_idx"             ON "inventory_items"("restaurantId", "branchId");
CREATE INDEX "inventory_categories_restaurantId_branchId_idx"        ON "inventory_categories"("restaurantId", "branchId");
CREATE INDEX "inventory_suppliers_restaurantId_branchId_idx"         ON "inventory_suppliers"("restaurantId", "branchId");
CREATE INDEX "inventory_goods_receipts_restaurantId_branchId_idx"    ON "inventory_goods_receipts"("restaurantId", "branchId");
CREATE INDEX "inventory_goods_receipt_lines_branchId_idx"            ON "inventory_goods_receipt_lines"("branchId");
CREATE INDEX "inventory_stock_layers_restaurantId_branchId_idx"      ON "inventory_stock_layers"("restaurantId", "branchId");
CREATE INDEX "inventory_stock_layers_restaurantId_branchId_itemId_status_idx" ON "inventory_stock_layers"("restaurantId", "branchId", "itemId", "status");
CREATE INDEX "inventory_stock_movements_restaurantId_branchId_idx"   ON "inventory_stock_movements"("restaurantId", "branchId");
CREATE INDEX "inv_stock_mov_rest_branch_item_occurred_idx" ON "inventory_stock_movements"("restaurantId", "branchId", "itemId", "occurredAt");
CREATE INDEX "inventory_processes_restaurantId_branchId_idx"         ON "inventory_processes"("restaurantId", "branchId");
CREATE INDEX "inventory_process_inputs_branchId_idx"                 ON "inventory_process_inputs"("branchId");
CREATE INDEX "inventory_process_outputs_branchId_idx"                ON "inventory_process_outputs"("branchId");
CREATE INDEX "inventory_process_runs_restaurantId_branchId_idx"      ON "inventory_process_runs"("restaurantId", "branchId");
CREATE INDEX "inventory_recipes_restaurantId_branchId_idx"           ON "inventory_recipes"("restaurantId", "branchId");
CREATE INDEX "inventory_recipe_lines_branchId_idx"                   ON "inventory_recipe_lines"("branchId");
CREATE INDEX "inventory_modifier_consumptions_restaurantId_branchId_idx" ON "inventory_modifier_consumptions"("restaurantId", "branchId");
CREATE INDEX "inventory_write_offs_restaurantId_branchId_idx"        ON "inventory_write_offs"("restaurantId", "branchId");
CREATE INDEX "inventory_write_off_lines_branchId_idx"                ON "inventory_write_off_lines"("branchId");
