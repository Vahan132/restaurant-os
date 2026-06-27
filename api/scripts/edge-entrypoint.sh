#!/bin/sh
# ── Edge hub entrypoint (OFF-1) ─────────────────────────────────────────────
# On bring-up: apply DB migrations, optionally run the TEMPORARY smoke seed,
# then start the compiled API. Used by docker-compose.edge.yml.
set -e

echo "[edge] applying database migrations (prisma migrate deploy)..."
node node_modules/prisma/build/index.js migrate deploy

# Optional temporary smoke seed — set EDGE_SEED=true to populate the configured
# branch BEFORE the real cloud snapshot exists (OFF-2 replaces this).
if [ "${EDGE_SEED:-false}" = "true" ]; then
  echo "[edge] EDGE_SEED=true — running temporary edge seed..."
  node node_modules/.bin/ts-node --transpile-only prisma/seed.edge.ts
fi

echo "[edge] starting API (APP_MODE=${APP_MODE:-CLOUD})..."
exec node dist/main.js
