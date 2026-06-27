# ── Restaurant OS API — container image ─────────────────────────────────────
# Multi-stage. Primarily used for the EDGE hub (docker-compose.edge.yml), where
# the entrypoint runs `prisma migrate deploy` (and an optional temporary seed)
# before starting the API. dev deps are kept in the runtime image on purpose so
# the Prisma CLI + ts-node are available for migrate/seed on bring-up.

# 1) Build — install everything, generate Prisma client, compile to dist/.
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# pnpm via corepack (version pinned by package.json "packageManager").
RUN corepack enable

# Install deps against the lockfile (cached unless manifests change).
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Source + generate Prisma client + build.
COPY . .
RUN pnpm prisma:generate \
  && pnpm build

# 2) Runtime — carry the full install (incl. Prisma CLI + ts-node) so the edge
# entrypoint can migrate + optionally seed, then run the compiled app.
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/tsconfig.build.json ./tsconfig.build.json

RUN chmod +x scripts/edge-entrypoint.sh

# Default to the edge bring-up flow (migrate -> optional seed -> start). For a
# plain run, override with: `node dist/main.js`.
ENTRYPOINT ["scripts/edge-entrypoint.sh"]
