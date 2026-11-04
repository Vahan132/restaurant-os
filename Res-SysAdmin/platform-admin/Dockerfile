# syntax=docker/dockerfile:1
# Restaurant OS — platform admin (Next.js). PRODUCTION image.
# Same conventions as admin/: per-app build context, API URL baked SAME-ORIGIN
# RELATIVE (/res/api) so one image runs local + staging unchanged; basePath
# /res/platform-admin is set in next.config.mjs. npm (this app has package-lock).
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL=/res/api
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=builder --chown=node:node /app /app
USER node
EXPOSE 4005
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "4005"]
