-- PAYNET-1: per-branch online payment provider config (Paynet.am). Secrets are
-- envelope-encrypted (AES-256-GCM under a per-row DEK wrapped by the master KEK).
CREATE TYPE "PaymentProviderKind" AS ENUM ('PAYNET');

CREATE TABLE "payment_provider_configs" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "provider" "PaymentProviderKind" NOT NULL DEFAULT 'PAYNET',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "livemode" BOOLEAN NOT NULL DEFAULT false,
    "api_key_last4" TEXT,
    "api_key_cipher" BYTEA,
    "api_key_iv" BYTEA,
    "api_key_auth_tag" BYTEA,
    "webhook_secret_cipher" BYTEA,
    "webhook_secret_iv" BYTEA,
    "webhook_secret_auth_tag" BYTEA,
    "dek_cipher" BYTEA,
    "dek_iv" BYTEA,
    "dek_auth_tag" BYTEA,
    "kek_version" INTEGER,
    "domain" TEXT,
    "processor" TEXT,
    "last_check_at" TIMESTAMP(3),
    "last_check_ok" BOOLEAN,
    "last_check_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_provider_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_provider_configs_restaurant_id_branch_id_key" ON "payment_provider_configs"("restaurant_id", "branch_id");
CREATE INDEX "payment_provider_configs_restaurant_id_idx" ON "payment_provider_configs"("restaurant_id");
