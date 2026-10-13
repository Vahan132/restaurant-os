-- FISCAL-EDGE-1: physical-HDM device config on the per-branch fiscal config.
-- One device per branch (1:1) — the fields hang off the existing per-branch
-- fiscal_configs row (already unique on (restaurant_id, branch_id)), NOT a new
-- 1:many table. host/port are non-secret. The device password is envelope-
-- encrypted under the SAME per-row DEK as cert/key (shared DEK), so it reuses the
-- existing dek_*/kek_version columns and needs no new DEK columns.
--
-- All columns are ADDED nullable: existing e-HDM-only rows are unaffected (device
-- fields stay NULL) and the migration is purely additive.
--
-- Deployment note (Option A — same master KEK cloud + hub): a hub that runs the
-- DB fiscal-config backend so it can read these synced rows offline MUST be
-- provisioned with, and boots only when it has, the SAME `FISCAL_MASTER_KEK` the
-- cloud wrapped the DEK with, PLUS `FISCAL_SRC_CA_PATH` (the shared SRC public CA
-- PEM). Both are enforced at boot by env.schema's `FISCAL_CONFIG_BACKEND=DB`
-- superRefine; a mismatched KEK fails closed at GCM auth-tag verification (no
-- plaintext leak). See EDGE_SETUP.md → "Fiscal config on the hub".

ALTER TABLE "fiscal_configs" ADD COLUMN "device_host" TEXT;
ALTER TABLE "fiscal_configs" ADD COLUMN "device_port" INTEGER;
ALTER TABLE "fiscal_configs" ADD COLUMN "device_pwd_cipher" BYTEA;
ALTER TABLE "fiscal_configs" ADD COLUMN "device_pwd_iv" BYTEA;
ALTER TABLE "fiscal_configs" ADD COLUMN "device_pwd_auth_tag" BYTEA;
