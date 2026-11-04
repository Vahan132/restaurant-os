-- BR-4: make operational entities branch-scoped (tables, orders, checkout/payments).
-- Existing rows land on the restaurant's DEFAULT branch, consistent with the
-- default-branch menu/stock from BR-2/BR-3. OrderItemModifier is reached via its
-- OrderItem (not branch-scoped). OrderCounter stays per-restaurant (order numbers
-- are shared across branches).

-- ── 1. Add branchId (NULLABLE first) ────────────────────────────────────────
ALTER TABLE "floors"            ADD COLUMN "branchId" TEXT;
ALTER TABLE "restaurant_tables" ADD COLUMN "branchId" TEXT;
ALTER TABLE "order_items"       ADD COLUMN "branchId" TEXT;
ALTER TABLE "payments"          ADD COLUMN "branchId" TEXT;
-- "orders".branchId already exists (nullable) from an earlier schema.

-- ── 2. Backfill ─────────────────────────────────────────────────────────────
UPDATE "floors" t            SET "branchId" = b."id" FROM "branches" b WHERE b."restaurantId" = t."restaurantId" AND b."isDefault" = true;
UPDATE "restaurant_tables" t SET "branchId" = b."id" FROM "branches" b WHERE b."restaurantId" = t."restaurantId" AND b."isDefault" = true;
UPDATE "orders" t            SET "branchId" = b."id" FROM "branches" b WHERE b."restaurantId" = t."restaurantId" AND b."isDefault" = true AND t."branchId" IS NULL;
-- Lines/payments inherit their order's branch.
UPDATE "order_items" t SET "branchId" = o."branchId" FROM "orders" o WHERE o."id" = t."orderId";
UPDATE "payments" t    SET "branchId" = o."branchId" FROM "orders" o WHERE o."id" = t."orderId";

-- ── 3. Enforce NOT NULL ─────────────────────────────────────────────────────
ALTER TABLE "floors"            ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "restaurant_tables" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "orders"            ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "order_items"       ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "payments"          ALTER COLUMN "branchId" SET NOT NULL;

-- ── 4. Table name uniqueness is now per-branch ──────────────────────────────
DROP INDEX "restaurant_tables_restaurantId_name_key";
CREATE UNIQUE INDEX "restaurant_tables_restaurantId_branchId_name_key"
    ON "restaurant_tables"("restaurantId", "branchId", "name");

-- ── 5. Branch-scoped indexes ────────────────────────────────────────────────
CREATE INDEX "floors_restaurantId_branchId_idx"            ON "floors"("restaurantId", "branchId");
CREATE INDEX "restaurant_tables_restaurantId_branchId_idx" ON "restaurant_tables"("restaurantId", "branchId");
CREATE INDEX "orders_restaurantId_branchId_idx"            ON "orders"("restaurantId", "branchId");
CREATE INDEX "orders_restaurantId_branchId_status_idx"     ON "orders"("restaurantId", "branchId", "status");
CREATE INDEX "order_items_restaurantId_branchId_idx"       ON "order_items"("restaurantId", "branchId");
CREATE INDEX "payments_restaurantId_branchId_idx"          ON "payments"("restaurantId", "branchId");
