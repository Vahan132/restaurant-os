-- FISCAL-4: per-tenant e-HDM fiscal config + encrypted secrets + department map.
-- Additive (new tables + enum); safe on existing rows. cert/key are AES-256-GCM
-- ciphertext (bytea); the KEK lives outside the DB (FISCAL_SECRET_KEK / KMS).

CREATE TYPE "FiscalEnvironment" AS ENUM ('PROD', 'TEST');

CREATE TABLE "fiscal_configs" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "crn" TEXT NOT NULL,
    "cashier_id" TEXT NOT NULL,
    "environment" "FiscalEnvironment" NOT NULL DEFAULT 'TEST',
    "language" TEXT NOT NULL DEFAULT 'hy',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "cert_cipher" BYTEA NOT NULL,
    "cert_iv" BYTEA NOT NULL,
    "cert_auth_tag" BYTEA NOT NULL,
    "key_cipher" BYTEA NOT NULL,
    "key_iv" BYTEA NOT NULL,
    "key_auth_tag" BYTEA NOT NULL,
    "dek_cipher" BYTEA NOT NULL,
    "dek_iv" BYTEA NOT NULL,
    "dek_auth_tag" BYTEA NOT NULL,
    "kek_version" INTEGER NOT NULL DEFAULT 1,
    "last_check_connection_at" TIMESTAMP(3),
    "last_check_connection_ok" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fiscal_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fiscal_configs_restaurant_id_branch_id_key" ON "fiscal_configs"("restaurant_id", "branch_id");
CREATE INDEX "fiscal_configs_restaurant_id_idx" ON "fiscal_configs"("restaurant_id");

CREATE TABLE "fiscal_departments" (
    "id" TEXT NOT NULL,
    "fiscal_config_id" TEXT NOT NULL,
    "dep" TEXT NOT NULL,
    "tax_regime" TEXT NOT NULL,
    "label" TEXT,
    CONSTRAINT "fiscal_departments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fiscal_departments_fiscal_config_id_dep_key" ON "fiscal_departments"("fiscal_config_id", "dep");
CREATE INDEX "fiscal_departments_fiscal_config_id_idx" ON "fiscal_departments"("fiscal_config_id");

ALTER TABLE "fiscal_departments" ADD CONSTRAINT "fiscal_departments_fiscal_config_id_fkey" FOREIGN KEY ("fiscal_config_id") REFERENCES "fiscal_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
