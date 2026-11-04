# Restaurant OS — Backend

Multi-tenant SaaS restaurant platform backend. NestJS + TypeScript, organized as
a **DDD modular monolith** (single package, no monorepo). This repo currently
contains the **foundation + tenancy backbone** (prompt 1). Business modules
(auth, menu, orders, …) follow in later prompts using
[`src/modules/MODULE_TEMPLATE.md`](./src/modules/MODULE_TEMPLATE.md).

## Stack

- NestJS 10 (TypeScript, strict mode)
- Prisma 5 + PostgreSQL 16
- `@nestjs/event-emitter` for domain events
- zod-validated env (fail-fast), Swagger at `/docs`
- ESLint + Prettier; pnpm; Node 20 LTS

## Prerequisites

- Node 20 LTS (`nvm use` reads `.nvmrc`)
- pnpm (`npm i -g pnpm`)
- Docker (for local PostgreSQL)

## Local run

```bash
# 1. install deps
pnpm install

# 2. configure env
cp .env.local.local.local.example .env.local.local.local

# 3. start PostgreSQL
pnpm docker:up           # docker compose up -d

# 4. generate client + run the initial migration
pnpm prisma:generate
pnpm prisma:migrate

# 5. seed demo data (idempotent)
pnpm db:seed

# 6. run the API (watch mode)
pnpm dev
```

Then:

- Health check: `GET http://localhost:3001/health` → `200`
- Swagger UI: `http://localhost:3001/docs`

## Quality gates

```bash
pnpm lint        # eslint, zero warnings
pnpm typecheck   # tsc --noEmit
pnpm build       # nest build
```

## Layout

See [`CONVENTIONS.md`](./CONVENTIONS.md) for API/DB/tenancy conventions and
[`src/modules/MODULE_TEMPLATE.md`](./src/modules/MODULE_TEMPLATE.md) for the
per-module DDD structure.
