# Restaurant OS — Web Admin

Next.js (App Router) admin frontend for the Restaurant OS backend. This is a
**separate** application from the backend; it talks to the API over HTTP at
`NEXT_PUBLIC_API_BASE_URL`.

This repository currently contains the **foundation only**: auth, API codegen,
i18n, the app shell with permission-gated navigation, and a single real screen
(the Dashboard) that proves the end-to-end pipe. Feature screens (Menu, Tables,
Orders, …) are placeholders to be built later.

## Requirements

- Node 20+
- pnpm 9 (`corepack enable` to get it)

## Getting started

```bash
pnpm install
cp .env.local.local.local.example .env.local.local.local        # adjust NEXT_PUBLIC_API_BASE_URL if needed
pnpm generate:api           # generate typed hooks from ./openapi.json
pnpm dev                    # http://localhost:3000
```

## Scripts

| Script              | Purpose                                              |
| ------------------- | ---------------------------------------------------- |
| `pnpm dev`          | Run the dev server                                   |
| `pnpm build`        | Production build                                     |
| `pnpm start`        | Serve the production build                           |
| `pnpm lint`         | ESLint                                               |
| `pnpm typecheck`    | `tsc --noEmit`                                       |
| `pnpm generate:api` | Regenerate `src/api/generated` from the OpenAPI spec |

## API codegen

`pnpm generate:api` runs [orval](https://orval.dev) using `orval.config.ts`.
The input defaults to `./openapi.json`; set `ORVAL_INPUT` to point elsewhere,
e.g. the live Nest swagger endpoint:

```bash
ORVAL_INPUT=http://localhost:3001/docs-json pnpm generate:api
```

Generated files live in `src/api/generated/` and are **never hand-edited**.
They call the custom axios mutator in `src/api/mutator.ts`, which unwraps the
backend success envelope, normalizes errors, and handles silent token refresh.

## Environment variables

| Variable                   | Default                 | Description                |
| -------------------------- | ----------------------- | -------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:3001` | Backend API base URL       |
| `ORVAL_INPUT`              | `./openapi.json`        | Codegen source (file/URL)  |
