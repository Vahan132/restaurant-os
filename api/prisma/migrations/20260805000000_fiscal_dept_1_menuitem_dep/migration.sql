-- FISCAL-DEPT-1: per-branch fiscal department code for a menu item. Additive,
-- nullable, safe on existing rows. No backfill: existing menu items keep a null
-- dep. For fiscal-active branches the fiscal print fail-closes on a null-dep line
-- (DEP_REQUIRED), replacing the previous silent lowest-department fallback; a
-- coverage/setup gate (separate UI ticket) surfaces the gaps before go-live.

-- The branch's SRC fiscal department this dish sells under, validated on
-- assignment against the branch's FiscalDepartment set and snapshotted onto
-- OrderItem.dep at order-build so the receipt line carries the correct VAT regime.
ALTER TABLE "menu_items" ADD COLUMN "dep" TEXT;
