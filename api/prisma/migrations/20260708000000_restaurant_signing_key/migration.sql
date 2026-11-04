-- OFF-5: per-restaurant token signing key (cloud↔edge token continuity).
--   Add a nullable 64-hex key and backfill every existing restaurant with a
--   random one (two md5s = 64 hex chars; no pgcrypto dependency). New
--   restaurants get a key lazily on first token issuance (cloud) or via the
--   provisioning snapshot (edge).

ALTER TABLE "restaurants" ADD COLUMN "token_signing_key" TEXT;

UPDATE "restaurants"
SET "token_signing_key" =
  md5(random()::text || "id" || clock_timestamp()::text) ||
  md5(random()::text || "id" || clock_timestamp()::text)
WHERE "token_signing_key" IS NULL;
