-- FISCAL-4-FE delta: a fiscal config can exist before its cert is uploaded (config
-- save and cert upload are separate support actions). Make the secret columns
-- nullable. Safe: the table has no rows yet, and existing configs would keep their
-- (non-null) values regardless.

ALTER TABLE "fiscal_configs" ALTER COLUMN "cert_cipher" DROP NOT NULL;
ALTER TABLE "fiscal_configs" ALTER COLUMN "cert_iv" DROP NOT NULL;
ALTER TABLE "fiscal_configs" ALTER COLUMN "cert_auth_tag" DROP NOT NULL;
ALTER TABLE "fiscal_configs" ALTER COLUMN "key_cipher" DROP NOT NULL;
ALTER TABLE "fiscal_configs" ALTER COLUMN "key_iv" DROP NOT NULL;
ALTER TABLE "fiscal_configs" ALTER COLUMN "key_auth_tag" DROP NOT NULL;
ALTER TABLE "fiscal_configs" ALTER COLUMN "dek_cipher" DROP NOT NULL;
ALTER TABLE "fiscal_configs" ALTER COLUMN "dek_iv" DROP NOT NULL;
ALTER TABLE "fiscal_configs" ALTER COLUMN "dek_auth_tag" DROP NOT NULL;
ALTER TABLE "fiscal_configs" ALTER COLUMN "kek_version" DROP NOT NULL;
ALTER TABLE "fiscal_configs" ALTER COLUMN "kek_version" DROP DEFAULT;
