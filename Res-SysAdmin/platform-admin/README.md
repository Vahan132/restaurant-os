# Platform Admin

Internal platform-administration panel for the Restaurant OS platform. Separate
Next.js app with its own `package.json`. Uses **platform auth** (distinct from
tenant auth) and the `/platform/*` API endpoints. Standard, clean admin UI,
English-only. API client is generated from `openapi.json` with **orval**.

## Stack

- Next.js 14 (App Router) + TypeScript (strict) + Tailwind CSS
- TanStack Query (React Query) + axios
- zustand (persisted auth store)
- orval codegen (react-query hooks + axios mutator)
- ESLint + Prettier

## Setup

```bash
npm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_BASE_URL
```

`NEXT_PUBLIC_API_BASE_URL` is the API origin (no trailing slash). All requests
go to `${NEXT_PUBLIC_API_BASE_URL}/platform/*`.

## Run

```bash
npm run generate:api   # regenerate src/api/generated from openapi.json
npm run dev            # http://localhost:3100
```

Other scripts: `npm run build`, `npm run typecheck`, `npm run lint`,
`npm run format`.

## Codegen

`npm run generate:api` runs orval (config in `orval.config.ts`) and writes
`src/api/generated/{endpoints,model}`. **Never hand-edit generated files** — change
the spec or the config and regenerate. The generated client routes every call
through the mutator in `src/lib/api-client.ts`.

## API client (mutator) — `src/lib/api-client.ts`

- `baseURL` from `NEXT_PUBLIC_API_BASE_URL`.
- Attaches the **platform** Bearer token from the auth store on every request
  except `/platform/auth/login` and `/platform/auth/refresh`.
- **Unwraps the success envelope** `{ success, data }` → `resource` or
  `{ items, pagination }`.
- **Normalizes errors** to `{ code, message, status }`.
- On **401**: calls `POST /platform/auth/refresh` once, then retries the original
  request. If refresh fails (or the failing request was refresh/login, or a retry
  was already attempted) it clears the store and redirects to `/login`. Concurrent
  401s share a single in-flight refresh (loop-guarded by an `_retry` flag + a
  refresh-path exclusion).

## Auth

`src/stores/auth-store.ts` — zustand store persisted to `localStorage`
(`{ accessToken, refreshToken, platformUser }`). `/login` posts to
`/platform/auth/login`, stores tokens, fetches `/platform/auth/me`, then routes to
the dashboard. `AuthGuard` redirects unauthenticated users to `/login`. Logout
posts to `/platform/auth/logout` and clears the store.

## Routes

| Route | Purpose |
| --- | --- |
| `/login` | Platform sign-in (outside the app shell) |
| `/` | Dashboard summary cards |
| `/organizations` | List, search/filter, provision new account |
| `/organizations/[id]` | Detail: restaurants+halls, subscription + history, users, suspend/activate |
| `/plans` | Plan CRUD incl. features editor + deactivate |
| `/subscriptions` | Organizations filtered by subscription status |
| `/users` | All users with filters |
| `/payments` | Billing placeholder (integration pending) |

## Notes / decisions

- **Money:** `priceAmount` is integer **minor units** (confirmed by the spec:
  "Price in integer minor units"). `src/lib/money.ts` formats by the plan's
  currency and converts the major-unit form input on save. Toggle `MINOR_UNITS`
  in that file if a backend stores major units.
- **List envelopes:** the OpenAPI types list endpoints as plain arrays, but the
  server returns `{ items, pagination }`. `toList()` in `src/lib/format.ts`
  normalizes both shapes so generated types stay untouched.
- **Org list filters:** `GET /platform/organizations` only documents `page`/`limit`,
  and `OrganizationSummaryResponse` only has `id/name/slug/status`. Status + name
  search are filtered client-side. Plan / subscription status / created columns
  render when the deployment includes them on the summary, otherwise `—`.
- **Plan active state:** create/update DTOs don't accept `isActive`; activation is
  controlled by the dedicated `deactivate` endpoint (no re-activate endpoint
  exists). The form shows active state read-only and offers Deactivate.
- **Platform vs tenant auth:** the client only ever obtains and sends the platform
  token via the `/platform/auth/*` flow, so a tenant token is never used here; the
  `/platform/*` endpoints additionally enforce platform auth server-side.
