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
cp .env.example .env.local      # set NEXT_PUBLIC_API_BASE_URL if not localhost:3001
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
`auth: { token }`, reconnects on token refresh, and remembers station
subscriptions across drops. `subscribeStations` emits `kds:subscribe`; typed
listeners cover `kds:ticket.new` / `.updated` / `.cancelled`. A connection-status
banner shows when disconnected. On reconnect the board refetches over HTTP (the
read model is the source of truth) via the `onReconnected` signal — wired through
`src/lib/realtime/useRealtime.ts`.

## Stations

Pick one or more of KITCHEN / BAR / DESSERT / OTHER. The choice persists to
localStorage (`src/lib/station/store.ts`) so the kiosk returns to the same board
after a reload. Selecting stations subscribes to their rooms and loads tickets.

## Ticket board (K2)

After a station is chosen, the board renders active tickets as glanceable cards
(`src/components/board/`), oldest-first, merging all selected stations onto one
screen. Each card shows the table name (or "Takeaway"), order number, a live
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
