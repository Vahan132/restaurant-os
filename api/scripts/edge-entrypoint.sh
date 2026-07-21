#!/bin/sh
# ── Edge hub entrypoint (OFF-1 / EDGE-SETUP-3A) ─────────────────────────────
# On bring-up: load any PERSISTED pairing identity, apply DB migrations,
# optionally run the TEMPORARY smoke seed, then start the compiled API. Used by
# docker-compose.edge.yml.
set -e

# EDGE-SETUP-3A: if the hub has been paired, POST /setup/pair wrote its identity
# (ids + node token + fiscal KEK) to this durable file. Source it BEFORE starting
# the app so every env-reader finds the values — in PREFERENCE to hand-edited env
# (sourced last wins). Absent ⇒ the hub boots UNPAIRED into setup mode.
IDENTITY_FILE="${EDGE_IDENTITY_PATH:-/data/edge-identity.env}"
if [ -f "$IDENTITY_FILE" ]; then
  echo "[edge] loading persisted identity from $IDENTITY_FILE"
  set -a
  # shellcheck disable=SC1090
  . "$IDENTITY_FILE"
  set +a
else
  echo "[edge] no persisted identity ($IDENTITY_FILE) — starting in SETUP MODE"
fi

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
