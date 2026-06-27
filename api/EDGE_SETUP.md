# Edge Hub Setup (OFF-1)

The Restaurant OS API boots in one of two **env-driven** runtime modes:

- **CLOUD** (default): multi-tenant SaaS, Redis Socket.IO adapter, cloud DB.
- **EDGE**: a single on-prem hub serving **exactly one branch** (one
  organization → restaurant → branch), a **local Postgres**, and an
  **in-process Socket.IO** adapter (no Redis).

OFF-1 makes an edge node bootable and serviceable **standalone**. OFF-2 adds
cloud **provisioning + the initial branch snapshot** (below). Config sync is
OFF-3, operational replay OFF-4, offline auth OFF-5, LAN discovery OFF-6.

---

## What changes in EDGE mode

| Concern | CLOUD | EDGE |
| --- | --- | --- |
| Socket.IO | Redis adapter (multi-instance fan-out) | in-process (single node) |
| Modules | all | cloud-only modules excluded: `platform`, `account`, `redis` |
| Tenant context | derived from JWT/host | **pinned** to the configured org/restaurant/branch on every request |
| Cross-tenant token | scoped normally | rejected (`EDGE_TENANT_MISMATCH`) |
| `X-Branch-Id` | selects an accessible branch | must equal the edge branch (else `BRANCH_NOT_FOUND`) |

Operational + catalog modules (auth, menu, inventory, orders, tables, KDS,
reservations, …) load normally in both modes.

---

## Prerequisites (mini-PC)

- A small Linux mini-PC (e.g. Intel NUC class) on the venue LAN.
- **Docker** + the Docker Compose plugin.
- A UPS for the hub **and** the network gear — see the operational checklist
  below. This is not optional: without it a power blip takes the whole floor down.

---

## Environment

Copy the example and fill it in:

```bash
cp .env.edge.example .env.edge
```

Required in EDGE (validated at boot — the app refuses to start if any is
missing):

| Var | Meaning |
| --- | --- |
| `APP_MODE=EDGE` | selects edge mode |
| `EDGE_ORG_ID` | the organization this hub serves |
| `EDGE_RESTAURANT_ID` | the restaurant this hub serves |
| `EDGE_BRANCH_ID` | the single branch this hub serves |
| `EDGE_NODE_ID` | stable id for this physical hub |
| `DATABASE_URL` | local Postgres (compose builds this for you) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | tenant token secrets |

`PLATFORM_JWT_*` secrets are still validated (placeholders are fine — the
platform module is excluded on edge). In production the `EDGE_*` ids come from
cloud provisioning (OFF-2); for a standalone smoke test pick stable values and
seed locally (below).

---

## Bring-up + migrate

```bash
# build image, start local Postgres + the API (EDGE mode), apply migrations
docker compose -f docker-compose.edge.yml --env-file .env.edge up -d --build
# (or: pnpm edge:up)
```

The API container's entrypoint (`scripts/edge-entrypoint.sh`) runs on every
start:

1. `prisma migrate deploy` — applies pending migrations to the local DB.
2. if `EDGE_SEED=true` — runs the **temporary** smoke seed (see below).
3. `node dist/main.js` — starts the API.

### Snapshot bootstrap (OFF-2 — the normal flow)

When `CLOUD_URL` + `EDGE_NODE_TOKEN` are set and the local DB is **unseeded**,
the hub pulls its branch snapshot from the cloud on boot and applies it
(`EdgeBootstrapService`). This is the normal way branch data reaches the edge —
keep `EDGE_SEED=false`.

### Smoke seed (OFF-1 fallback — no cloud)

To smoke-test a hub with NO cloud, set `EDGE_SEED=true` to create a minimal
dataset for the configured branch (organization + restaurant + settings +
default branch + system roles + an OWNER user), pinned to your exact `EDGE_*`
ids. Default login: `owner@edge.local` / `ChangeMe123!`
(override with `EDGE_SEED_OWNER_EMAIL` / `EDGE_SEED_OWNER_PASSWORD`).

```bash
EDGE_ORG_ID=... EDGE_RESTAURANT_ID=... EDGE_BRANCH_ID=... pnpm db:seed:edge
```

> ⚠️ The seed is a throwaway. Prefer the OFF-2 snapshot for any real data.

---

## Provisioning + snapshot (OFF-2)

### 1. Register the node (cloud, one-time)

An owner/manager (holding the restaurant-wide `EDGE_MANAGE` permission) registers
a node for the branch the hub will serve:

```bash
curl -X POST https://<cloud>/edge-nodes \
  -H "Authorization: Bearer <owner-access-token>" \
  -H "Content-Type: application/json" \
  -d '{ "branchId": "<branch-id>", "name": "Kitchen hub" }'
# → { id, branchId, name, status: "ACTIVE", token: "<PLAINTEXT — shown ONCE>" }
```

Store the returned `token` on the hub as `EDGE_NODE_TOKEN`. Only its sha256 hash
is kept in the cloud. List/revoke:

```bash
curl https://<cloud>/edge-nodes        -H "Authorization: Bearer <token>"
curl -X POST https://<cloud>/edge-nodes/<id>/revoke -H "Authorization: Bearer <token>"
```

### 2. Pair + bootstrap (edge)

Set on the hub:

```bash
CLOUD_URL=https://<cloud>
EDGE_NODE_TOKEN=<plaintext from step 1>
```

On first boot (unseeded DB) the hub pulls `GET {CLOUD_URL}/edge/snapshot` with the
node token and applies the branch slice — catalog, the branch's
users/roles/memberships (incl. password hashes for offline login), current OPEN
stock layers, tables, and currently-open orders/upcoming reservations — all with
the **same ids as cloud**. `GET /edge/info` then reports the branch serving its
real data.

### 3. Resync on demand

```bash
curl -X POST http://<hub-ip>:3001/edge/resync \
  -H "Authorization: Bearer <owner-access-token-on-the-hub>"
```

Idempotent — re-applies the latest snapshot (upserts by id). A revoked or unknown
node token makes the snapshot pull fail with `401`.

> Notes: pairing/bootstrap require connectivity; the hub operates offline between
> syncs. The edge mirrors cloud ids; any NEW record it creates offline gets a
> fresh cuid and replays to cloud by id in OFF-4.

---

## Verify the hub

```bash
curl http://<hub-ip>:3001/edge/info
```

Returns the hub identity + liveness + sync/version telemetry (no auth required):

```json
{
  "mode": "EDGE",
  "organizationId": "edge-org-0001",
  "restaurantId": "edge-restaurant-0001",
  "branchId": "edge-branch-0001",
  "nodeId": "edge-node-kitchen-01",
  "appVersion": "0.1.0",
  "schemaVersion": "2",
  "expectedSchemaVersion": "2",
  "db": "ok",
  "online": true,
  "lastConfigSyncedAt": "2026-06-27T00:00:00.000Z",
  "pendingOutbox": 0,
  "lastPushedSeq": 42,
  "lastPushAt": "2026-06-27T00:00:00.000Z",
  "lastHeartbeatAt": "2026-06-27T00:00:00.000Z",
  "syncPaused": false,
  "updateRequired": false,
  "serverTime": "2026-06-27T00:00:00.000Z"
}
```

> `schemaVersion`/`expectedSchemaVersion` are the **edge sync schema version** — an
> app constant (currently `2`), **not** the Prisma migration name. The cloud and
> the hub compare this single value to decide whether they may sync (see OFF-8).

Then:

- Log in via `POST /auth/login` with the seeded owner; the issued token works
  against the operational APIs (tenant pinned to the edge branch).
- Connect a Socket.IO client to `/realtime` with the token — it runs in-process
  (no Redis) and binds to the edge branch.

---

## Config sync (OFF-3)

Config (menu/catalog, inventory items, recipes/processes, users/roles/branch
memberships, settings/timezone/currency) is **cloud-authoritative and read-only
on the edge**. The hub mirrors it; it never edits config locally, so there are no
config conflicts. (Stock + operational data sync *up* separately in OFF-4.)

How it works:

- The hub stores a `lastConfigCursor` (ISO timestamp). On a schedule
  (`CONFIG_SYNC_INTERVAL_MS`, default 2 min) and shortly after boot, it calls
  `GET {CLOUD_URL}/edge/config-sync?since=<cursor>` with the node token.
- The cloud returns every config record changed since the cursor — **including
  soft-deleted ones** — plus a new cursor pulled back by a 60s overlap so nothing
  is skipped across windows. The hub applies upserts + soft-deletes (preserving
  cloud ids), reconciles branch memberships and recipe/process children, and
  advances the cursor. Re-applying a window is a no-op (idempotent).
- **Connectivity** is detected by the sync itself: success ⇒ `online: true`,
  failure ⇒ `online: false` (the hub keeps its last-synced config and serves
  normally, retrying next tick). On reconnect it catches up from its cursor.

`GET /edge/info` reports `online` + `lastConfigSyncedAt`. Force a pull now:

```bash
curl -X POST http://<hub-ip>:3001/edge/sync-config \
  -H "Authorization: Bearer <owner-access-token-on-the-hub>"
```

Safety: config changes never destroy operational records — a changed or
soft-deleted menu item still resolves for historical/in-flight edge orders
(orders capture their own line snapshots; soft-deleted catalog stays readable).
Config sync never touches stock layers.

## Operational sync (OFF-4)

While the hub is running it is the **single authority** for its branch's
operations and stock. Operations flow **edge→cloud** as an append-only,
idempotent stream; config still flows down only (OFF-3) and is never in this
stream.

How it works:

- Every operational write on the edge (orders + lines, payments, KDS ticket
  transitions, stock movements + layer changes, goods receipts, write-offs,
  process runs, reservations) appends an `OutboxEntry` capturing the record's
  full current state — **in the same transaction as the write**, so nothing is
  missed. Each entry gets a gapless, monotonic `edgeSeq`. Config writes never
  append.
- A push loop (`EDGE_PUSH_INTERVAL_MS`, default 30s; also `POST /edge/push-now`)
  drains PENDING entries in `edgeSeq` order to `POST {CLOUD_URL}/edge-sync/push`
  with the node token. The cloud upserts each record by id, scoped to the node's
  branch, and returns the applied ids; the edge marks those SYNCED and advances
  `lastPushedSeq`. It never advances past an unacked entry, so a dropped or
  partial push simply resumes — at-least-once delivery + idempotent apply =
  effectively once.
- Replaying the edge's stock movements (the audit ledger) plus its stock layer
  states (remaining qty + new layers) converges the cloud's branch stock
  **exactly** to the edge.

`GET /edge/info` reports `pendingOutbox`, `lastPushedSeq`, and `lastPushAt`
(pending → 0 after a full sync). Offline, entries accumulate as PENDING and serve
normally; on reconnect the loop catches up with no gaps or duplicates.

### Conflict-avoidance rule (MVP — important)

While a branch's hub is active, the **cloud must NOT independently mutate that
branch's operational or stock data** — those writes happen at the edge and
replay up. The cloud side of operations is effectively read-only for an
edge-managed branch. Bidirectional operational conflict resolution is **out of
scope** for this MVP; the model assumes a branch is wholly edge-managed while its
hub runs. (Config remains cloud-authoritative and flows down — that is the only
direction config moves.)

## Monitoring, versioning & updates (OFF-8)

A running hub is the authority for its branch while it is up, so operators need to
see that it is healthy, and the system must refuse to sync a hub whose schema is
too old to be safe.

### Heartbeat + telemetry

- Every `EDGE_HEARTBEAT_INTERVAL_MS` (30–60s, default 45s) the hub POSTs
  `{CLOUD_URL}/edge-sync/heartbeat` (node-token auth) reporting: pending outbox
  count, last config-sync time, last pushed seq, **appVersion**, **schemaVersion**,
  local DB status, and uptime.
- The cloud records this on the node (`lastHeartbeatAt`, `pendingOutboxCount`,
  `appVersion`, `schemaVersion`) and derives a **health status**:
  `OK` → `SYNC_BACKLOG` (pending outbox over threshold) → `SCHEMA_MISMATCH`
  (version gap). **Online/offline is derived on read** from heartbeat recency: no
  heartbeat within `EDGE_OFFLINE_THRESHOLD_MS` (cloud, default 3 min) ⇒ `OFFLINE`.
- An admin sees it on the cloud node list:

  ```bash
  curl https://<cloud>/edge-nodes -H "Authorization: Bearer <owner-access-token>"
  # each node → { ..., lastHeartbeatAt, pendingOutboxCount, appVersion,
  #               healthStatus: "OK" | "SYNC_BACKLOG" | "SCHEMA_MISMATCH" | "OFFLINE",
  #               online, updateAvailable }
  ```

- Stop the hub → after the threshold its status reads `OFFLINE` (no heartbeat).
- Operate offline to build a backlog → `pendingOutbox` rises in `/edge/info` and
  in the node's telemetry, then returns to `0` after reconnect drains the outbox.

### Schema-version guard (prevents a corrupt sync)

The edge **sync schema version** is an app constant (`SCHEMA_VERSION`, currently
`2`) — bumped only on an edge-incompatible schema/contract change, **not** on
every migration. The hub sends it on every sync request (`x-edge-schema-version`).

- `/edge/snapshot`, `/edge/config-sync`, and `/edge-sync/push` compare it to the
  cloud's expected version. On a mismatch they return **`SCHEMA_MISMATCH` (HTTP
  426)** and record the mismatch on the node so an admin sees it.
- On a mismatch the hub **pauses sync**: it stops pulling config and pushing the
  outbox, but **keeps operating locally** — serving the floor, taking orders,
  accruing its outbox. `/edge/info` shows `syncPaused: true` and
  `updateRequired: true`, and the hub logs the reason clearly.
- The heartbeat endpoint is **not** schema-guarded, so a stale hub still reports
  in and learns it must update. Once the hub runs a matching version again, the
  next heartbeat clears the pause and **sync resumes automatically**.

To verify the flow without shipping a real schema change, set
`EDGE_SCHEMA_VERSION` on the hub to a value the cloud does not expect (testing
override), confirm sync pauses and `/edge/info` shows `updateRequired: true`, then
unset it and confirm sync resumes.

### Update procedure (operator-driven)

The cloud knows the expected `appVersion`/`schemaVersion` and flags hubs behind it
(`updateAvailable` / `healthStatus: SCHEMA_MISMATCH`). **Automatic updates are out
of scope for this MVP** — a bad auto-update could brick a hub mid-service, so
updates are deliberate and operator-driven. To update a hub:

```bash
# on the hub
docker compose -f docker-compose.edge.yml --env-file .env.edge pull
docker compose -f docker-compose.edge.yml --env-file .env.edge up -d
#   ↑ the entrypoint runs `prisma migrate deploy` against the LOCAL DB on start,
#     then restarts the API on the new image.
curl http://<hub-ip>:3001/edge/info   # confirm appVersion/schemaVersion updated
```

Then confirm `syncPaused: false` and `updateRequired: false` and that
`lastConfigSyncedAt` / `lastPushAt` advance again (sync resumed). Update during a
quiet period; the hub keeps serving throughout, and its outbox drains once sync
resumes.

## How LAN apps reach the hub

For now, point LAN clients (POS, KDS displays) at `http://<hub-ip>:3001`. They
can confirm they're paired to the right hub by reading `GET /edge/info` and
checking `organizationId` / `restaurantId` / `branchId` / `nodeId`.

> Automatic LAN discovery / pairing is OFF-6 (placeholder).

---

## Operational checklist (hardware + network)

The hub is the single authority for the branch while it runs, so its power and
network must be the most reliable things in the venue.

- **UPS — hub AND network gear.** The tablets/POS devices have their own
  batteries; **the hub, the WiFi router, and any switch do not.** Put the hub
  *and* the router/switch on a UPS so a power blip doesn't take the whole floor
  offline. Size the UPS for your expected ride-through (cover the longest typical
  outage plus a safety margin); for longer outages, configure a graceful shutdown
  on low battery so the hub stops cleanly rather than losing power mid-write.
- **Wired hub.** Connect the hub to the router/switch over Ethernet where
  possible — far more reliable than WiFi for the device every client depends on.
- **Stable address.** Give the hub a **static IP or a DHCP reservation** (and,
  ideally, a hostname) so POS/KDS clients reliably find it at the same
  `http://<hub-ip>:3001` across reboots.
- **Placement.** Site the hub somewhere ventilated, dry, and physically secure
  (not on the floor, not where it can be unplugged or splashed).
- **Monitoring.** Watch the cloud node list (`healthStatus`, `online`,
  `pendingOutbox`, `updateAvailable`) to catch an offline hub, a growing backlog,
  or a hub that needs updating — see *Monitoring, versioning & updates (OFF-8)*.
- **Updates.** Apply hub updates deliberately during a quiet period using the
  documented procedure; never rely on auto-update.

## Notes & limitations (OFF-1)

- The hub is **offline-capable** for serving its branch, but does not sync with
  the cloud yet (OFF-2/3/4) and uses cloud-issued tokens as-is (true offline
  login is OFF-5).
- Public/storefront host-resolution surfaces are not separately pinned — only
  one restaurant exists on the hub, so they resolve to it.
- CLOUD mode is unchanged: Redis adapter, multi-tenant, all modules.
