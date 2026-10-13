# syntax=docker/dockerfile:1
# Restaurant OS — admin (Next.js). PRODUCTION image.
# Per-app build context; no workspace/shared build dep (generated client vendored).
# pnpm pinned via npm -g (Node-20 safe, deterministic). API/socket URLs baked as
# SAME-ORIGIN RELATIVE so one image runs local + staging unchanged. Runtime starts
# Next directly with node (no pnpm/corepack at runtime -> no per-user cache issues).
FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN npm install -g pnpm@9.12.0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL=/res/api
ARG NEXT_PUBLIC_SOCKET_BASE_URL=
ARG NEXT_PUBLIC_SOCKET_PATH=/res/socket.io
ARG NEXT_PUBLIC_CUSTOMER_URL_TEMPLATE=/res/m/{slug}?qr={qr}
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_SOCKET_BASE_URL=$NEXT_PUBLIC_SOCKET_BASE_URL \
    NEXT_PUBLIC_SOCKET_PATH=$NEXT_PUBLIC_SOCKET_PATH \
    NEXT_PUBLIC_CUSTOMER_URL_TEMPLATE=$NEXT_PUBLIC_CUSTOMER_URL_TEMPLATE
RUN pnpm build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder --chown=node:node /app /app
USER node
EXPOSE 4001
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "4001"]
