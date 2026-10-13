-- FISCAL-0: dish-level ATG code + fatal fiscal-error marker (both additive,
-- nullable, safe on existing rows). No backfill: existing menu items keep a null
-- adgCode (FISCAL-1 fail-closes their fiscal print until classified), and existing
-- orders keep a null fiscalError (no fatal error recorded).

-- The SOLD dish's SRC ATG classifier code, snapshotted onto order lines at build.
ALTER TABLE "menu_items" ADD COLUMN "adg_code" TEXT;

-- Fatal-config fiscal error marker (SRC code); stops the ConfirmPayment retry loop.
ALTER TABLE "orders" ADD COLUMN "fiscal_error" TEXT;
