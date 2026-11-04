-- HDM-TM-1: physical HDM (TouchMaster / SRC external-app protocol) operator login.
-- fn 2 (login) needs the HDM operator code + PIN. PIN is envelope-encrypted under
-- the row's existing DEK (same as the device password). Additive + nullable.
ALTER TABLE "fiscal_configs" ADD COLUMN "device_cashier_id" INTEGER;
ALTER TABLE "fiscal_configs" ADD COLUMN "device_pin_cipher" BYTEA;
ALTER TABLE "fiscal_configs" ADD COLUMN "device_pin_iv" BYTEA;
ALTER TABLE "fiscal_configs" ADD COLUMN "device_pin_auth_tag" BYTEA;
ALTER TABLE "fiscal_configs" ADD COLUMN "device_use_ext_pos" BOOLEAN NOT NULL DEFAULT true;
