# Restaurant POS — Frontend

Touch-first tablet POS for waiters/cashiers. **Separate Next.js app** (own `package.json`);
the backend is reached over HTTP. This is the **foundation** only — codegen, auth, API client,
realtime, i18n, a touch shell, and a placeholder table-select home that proves the pipe.
Order/checkout screens are P2–P5.

## Stack

Next.js 15 (App Router) · TypeScript (strict) · Tailwind · TanStack Query · orval (OpenAPI →
typed hooks) · axios · zustand · socket.io-client · next-intl (hy/ru/en).

## Prerequisites

- Node 20+
- pnpm
- A running Restaurant OS backend (default `http://localhost:3001`)

## Setup

```bash
pnpm install
cp .env.local.local.local.example .env.local.local.local.local   # set NEXT_PUBLIC_API_BASE_URL if not localhost:3001
pnpm generate:api            # generate typed hooks from ./openapi.json
pnpm dev                     # http://localhost:3002
```

## Scripts

| Script              | What it does                                            |
| ------------------- | ------------------------------------------------------- |
| `pnpm dev`          | Dev server on port 3002                                 |
| `pnpm build`        | Production build                                        |
| `pnpm start`        | Serve the production build                              |
| `pnpm lint`         | ESLint (Next core-web-vitals + TS + Prettier)           |
| `pnpm typecheck`    | `tsc --noEmit`                                           |
| `pnpm generate:api` | Regenerate `src/api/generated` from `./openapi.json`    |
| `pnpm format`       | Prettier write                                          |

## Codegen

`orval.config.ts` reads `./openapi.json` and emits TanStack Query hooks into
`src/api/generated` (split by tag), routing every request through the custom axios mutator at
`src/api/mutator.ts`. **Never hand-edit `src/api/generated`** — rerun `pnpm generate:api`.
To regenerate from a live server instead of the committed spec, point `input.target` at the
backend's `/docs-json`.

## Key locations (reused by P2–P5)

- **API client / mutator:** `src/api/mutator.ts` (baseURL, Bearer, envelope unwrap, error
  normalize, 401 → single refresh + retry).
- **Auth store:** `src/stores/auth.ts` (zustand, persisted to localStorage).
- **Realtime client:** `src/lib/realtime/` — `RealtimeProvider.tsx`, `useRealtimeEvent.ts`,
  `events.ts`.
- **Money util:** `src/lib/money.ts` (`toMinor` / `fromMinor` / `formatMoney`) and the
  currency-aware hook `src/lib/useMoney.ts`.
- **Permissions:** `src/lib/permissions.tsx` (`PERMISSIONS`, `usePermission`, `<Can>`).
- **i18n:** `messages/{en,ru,hy}.json`, `src/i18n/`.
