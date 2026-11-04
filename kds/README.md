# RES — Kitchen Display System (KDS)

A standalone Next.js (App Router) frontend for the kitchen screen. It talks to the
RES backend over HTTP and socket.io. This is the **foundation only** (codegen, auth,
client wrapper, realtime, i18n, kiosk shell, station picker, and a placeholder board
that proves the pipe). The real ticket board is **K2**.

## Stack

Next.js 14 (App Router) · TypeScript (strict) · Tailwind · TanStack Query · orval +
axios codegen · zustand · socket.io-client · next-intl (hy / ru / en). Node 20+.

## Quick start

```bash
pnpm install
cp .env.local.local.local.example .env.local.local.local.local      # set NEXT_PUBLIC_API_BASE_URL if not localhost:3001
pnpm generate:api               # generate typed hooks from ./openapi.json
pnpm dev                        # http://localhost:3002
```

Other scripts: `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm typecheck`, `pnpm format`.

## Environment

| Var | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:3001` | Backend HTTP API (axios + codegen) |
| `NEXT_PUBLIC_REALTIME_URL` | = API base | socket.io origin (`/realtime` namespace) |

## OpenAPI codegen

`orval.config.ts` reads `./openapi.json` and emits react-query hooks into
`src/api/generated/` using the custom axios mutator at `src/api/mutator.ts`.
Regenerate with `pnpm generate:api`. **Never hand-edit files under
`src/api/generated/`** — they are overwritten on every run. To pull the spec live,
point the input at `${NEXT_PUBLIC_API_BASE_URL}/docs-json`.

## Auth & access

- Tokens + user persist in localStorage via a zustand store (`src/lib/auth/store.ts`).
- `/login` posts to `/auth/login`, then `GET /auth/me` to load permissions.
- **KDS_ACCESS is required.** A signed-in user without it sees a "No kitchen access"
  screen with a logout button and can never reach the board.
- The axios mutator unwraps the success envelope, normalizes errors to
  `{ code, message }`, and on 401 refreshes once + retries (loop-guarded) before
  clearing the store and redirecting to `/login`.
- PIN / device login is a planned future improvement.

## Realtime

`src/lib/realtime/client.ts` connects to the `/realtime` namespace with
`auth: { token, branchId, station }`, reconnects on token refresh **or** when the
pin changes, and re-subscribes to its `branch:station` room across drops. On
connect it emits `kds:subscribe { branchId, station }`; typed listeners cover
`kds:ticket.new` / `.updated` / `.cancelled`. A connection-status banner shows
when disconnected. On reconnect the board refetches over HTTP (the read model is
the source of truth) via the `onReconnected` signal — wired through
`src/lib/realtime/useRealtime.ts`.

## Branch + station pinning

Setup pins the device to **one branch AND one station** (KITCHEN / BAR / DESSERT
/ OTHER). The branch is chosen from `GET /restaurant/branches` (auto-selected
when the account has a single active branch); the pin persists per device to
localStorage (`src/lib/branch/store.ts` + `src/lib/station/store.ts`) so the
kiosk returns to the same board after a reload. The active branch + station are
shown in the top strip so a screen is never mistaken for another location's.

The pin scopes everything: the socket handshake carries the branch + station and
subscribes to ONLY that `branch:station` room, and ticket reads
(`GET /kds/stations/:station/tickets`) plus the preparing/ready mutations send an
`X-Branch-Id` header (injected via the orval `request` option in
`src/lib/kds/branchRequest.ts`, so no generated file is hand-edited) and cache
under a branch-scoped query key.

## Ticket board (K2)

Once pinned, the board renders the branch+station's active tickets as glanceable
cards (`src/components/board/`), oldest-first. Each card shows the table name (or
"Takeaway"), order number, a live
count-up timer, a prominent order note, and this station's items with quantity,
modifiers, item note, and per-item status. Per-item **Start** (SENT→PREPARING)
and **Ready** (PREPARING→READY) actions hit the KDS endpoints and refetch; a
ticket-level **Mark order ready** readies the whole order. A single `ClockProvider`
drives every timer. Items/tickets are flagged **delayed** live — honoring the
backend `delayed` flag and recomputing `elapsed > prepTime·60` (900s default)
client-side — with escalating colors. Fully-ready tickets show an "awaiting
pickup" state and can be locally **bumped** (client-only; no bump endpoint — the
order also drops off when served/closed). New-ticket events play an optional
WebAudio chime with a persisted mute toggle in the top strip. All `kds:ticket.*`
events and the K1 reconnect signal trigger HTTP refetches so the board always
matches server state.
