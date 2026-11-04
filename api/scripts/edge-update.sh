#!/bin/sh
# ── EDGE-PKG-1 §2.3 — Docker-generic edge update ────────────────────────────
# Pull the newer public image and restart. Host-OS-agnostic: identical on
# Windows/Linux/macOS. No registry credentials (the image is public).
#
#   Update in place:   ./edge-update.sh
#   Pin then update:   EDGE_IMAGE_TAG=edge-v0.2.0 ./edge-update.sh
#
# Why this is safe:
#   * The entrypoint runs `prisma migrate deploy` on every boot, so the sequence
#     is pull → migrate the LOCAL edge DB → restart. Migrations are forward-only
#     and idempotent (deploy applies only un-applied migrations, never resets).
#   * The named volumes (edge_data = pairing identity, edge_pgdata = the DB)
#     survive `up -d` container recreation, so identity + data are preserved.
#   * If an update lands mid-outage, re-running is safe: `migrate deploy` is a
#     no-op when already applied, and `up -d` only recreates changed containers.
set -e

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.edge.yml}"
ENV_FILE="${ENV_FILE:-.env.edge}"

cd "$(dirname "$0")/.."

echo "[edge-update] pulling image (${EDGE_IMAGE_TAG:-latest})..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull

echo "[edge-update] restarting (migrate deploy runs on boot)..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

echo "[edge-update] done. Current containers:"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
