# ── Restaurant OS API — container image ─────────────────────────────────────
# Multi-stage. Primarily used for the EDGE hub (docker-compose.edge.yml), where
# the entrypoint runs `prisma migrate deploy` (and an optional temporary seed)
# before starting the API. dev deps are kept in the runtime image on purpose so
# the Prisma CLI + ts-node are available for migrate/seed on bring-up.
#
# EDGE-PKG-1: the runtime image is PUBLIC and secret-free (no build args, no baked
# credentials; CLOUD_URL is a non-secret overridable constant) and runs as a
# NON-ROOT `node` user. Identity + KEK + device config arrive only at runtime via
# pairing/sync onto the /data volume — never baked in.

# 1) Build — install everything, generate Prisma client, compile to dist/.
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# pnpm via corepack (version pinned by package.json "packageManager").
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install deps against the lockfile (cached unless manifests change).
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Source + generate Prisma client + build.
COPY . .
RUN pnpm prisma:generate \
  && pnpm build

# Fail the build LOUDLY if the compile didn't emit the file the runtime starts
# (dist/main.js). edge-v0.1.3 shipped WITHOUT it — `pnpm build` exited 0 but no
# main.js was emitted — producing an image that crash-loops at runtime with
# "Cannot find module '/app/dist/main.js'". This guard turns that into a failed
# image build instead of a broken published image.
RUN test -f dist/main.js || { echo "BUILD ERROR: 'pnpm build' did not emit dist/main.js"; echo "dist/ contents:"; ls -laR dist; exit 1; }

# 2) Runtime — carry the full install (incl. Prisma CLI + ts-node) so the edge
# entrypoint can migrate + optionally seed, then run the compiled app.
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/tsconfig.build.json ./tsconfig.build.json

RUN chmod +x scripts/edge-entrypoint.sh

# EDGE-PKG-1: CLOUD_URL is a NON-SECRET image constant (the platform base the hub
# pairs against). Baked here as an overridable placeholder — set the real URL per
# deployment (compose env / -e CLOUD_URL=...). Empty ⇒ the hub runs offline/seed-
# only until paired. No secret is baked into the image.
ENV CLOUD_URL=""

# EDGE-PKG-1 hardening: run as a NON-ROOT user. The base image ships an unprivileged
# `node` user (uid 1000). The durable identity + media live under /data (the
# edge_data named volume); create it owned by `node` so a fresh volume inherits
# that ownership (Docker seeds a new named volume from the image path) and the
# app can write the 0600 identity file + /data/media without root.
RUN mkdir -p /data/media && chown -R node:node /data
USER node

# Default to the edge bring-up flow (migrate -> optional seed -> start). For a
# plain run, override with: `node dist/main.js`.
ENTRYPOINT ["scripts/edge-entrypoint.sh"]
