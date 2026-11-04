# syntax=docker/dockerfile:1
# Restaurant OS — website (public marketing + account). PRODUCTION image.
# Per-app build context (no workspace/shared build dep; the generated API client
# is vendored in src/api/generated). API + cross-app URLs are baked as SAME-ORIGIN
# RELATIVE paths so ONE image runs local and staging unchanged (proxy serves all
# surfaces on one origin). website uses npm (package-lock.json; no pnpm-lock).
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL=/res/api
ARG NEXT_PUBLIC_ADMIN_URL=/res/admin
ARG NEXT_PUBLIC_POS_URL=/res/pos
ARG NEXT_PUBLIC_KDS_URL=/res/kds
ARG NEXT_PUBLIC_CUSTOMER_URL_TEMPLATE=/res/m/{slug}?qr={qr}
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_ADMIN_URL=$NEXT_PUBLIC_ADMIN_URL \
    NEXT_PUBLIC_POS_URL=$NEXT_PUBLIC_POS_URL \
    NEXT_PUBLIC_KDS_URL=$NEXT_PUBLIC_KDS_URL \
    NEXT_PUBLIC_CUSTOMER_URL_TEMPLATE=$NEXT_PUBLIC_CUSTOMER_URL_TEMPLATE
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder --chown=node:node /app /app
USER node
EXPOSE 4000
# package.json "start" pins the port: next start -p 4000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "4000"]
