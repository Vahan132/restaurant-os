# OFF-8-UI — Hubs (edge node registration + monitoring): implementation notes

Restaurant-level **Hubs** screen for registering, monitoring, and revoking a
restaurant's edge nodes. Built on the A1 foundation and the existing
table / form / modal / confirm / toast patterns (mirrors the BR-7 branch
management screen). No new design language.

## What was built

Route `/hubs`, gated by `EDGE_MANAGE` resolved **restaurant-wide** (scope
`restaurant`), so the owner sees it regardless of the active branch.

- **List** (`GET /edge-nodes`) with telemetry per node: branch, name, status,
  last heartbeat, last config sync, last operational push, pending count, and
  app / schema version. Auto-refreshes every 15s (`refetchInterval`) plus on
  window focus, so status stays current without a manual reload.
- **Status + warnings** are derived client-side from telemetry in
  `src/lib/hubs/status.ts` so the badge and the warnings always agree:
  - **Offline** — no heartbeat within 2 min (red status + red heartbeat cell).
  - **Sync backlog** — pending pushes over threshold (amber status + amber
    pending badge).
  - **Needs update** — node schema ≠ platform's expected schema (amber status +
    amber schema version with a **“Update steps”** link opening the steps).
  - Severity order: offline > needs update > backlog > online.
- **Register** (`POST /edge-nodes`) — pick a branch + name; on success the node
  token is shown **once** in a copyable modal (`hub-token-modal`) with pairing
  instructions and a ready-to-paste `EDGE_NODE_TOKEN=…` line. It is never shown
  again.
- **Revoke** (`POST /edge-nodes/:id/revoke`) — behind the shared confirm dialog;
  revoked nodes show a gray “Revoked” badge and the action is disabled.
- Loading skeletons, empty state, error state, success/error toasts, and full
  i18n (hy / ru / en) including a `nav.hubs` label.

### Files added
- `src/app/(app)/hubs/page.tsx`
- `src/components/hubs/hubs-manager.tsx`, `register-hub-modal.tsx`,
  `hub-token-modal.tsx`
- `src/lib/hubs/use-hubs-data.ts` (list + invalidation + polling),
  `src/lib/hubs/status.ts` (status/warning derivation + localized time helpers)
- `src/api/generated/edge-nodes/edge-nodes.ts` and
  `src/api/generated/model/{edgeNodeResponse,edgeNodeResponseStatus,registerEdgeNodeDto,registerEdgeNodeResponse}.ts`
  (see codegen note below)

### Files changed
- `src/lib/permissions.ts` — adds `EDGE_MANAGE` (restaurant-wide).
- `src/components/shell/nav-config.ts` — adds the `hubs` item (scope `restaurant`).
- `src/api/generated/model/index.ts` — exports the new edge-node models.
- `messages/{en,ru,hy}.json` — new `hubs` namespace + `nav.hubs`.

## ⚠️ API codegen could not be run in this environment

Same situation BR-7 documented: the live backend swagger was unreachable and the
local `openapi.json` is truncated, so `orval` could not be run without
destroying the existing generated client. The `/edge-nodes` paths are present in
the spec but their schemas (`EdgeNodeResponse`, `RegisterEdgeNodeDto`,
`RegisterEdgeNodeResponse`) were past the truncation point.

To keep the app compiling and the hook call-sites correct, the edge-node
endpoints were added as **hand-authored generated-style modules** that match the
operationId-derived names a real `generate:api` will emit. They live alongside
the real generated client and are clearly marked. **Re-run codegen against the
backend** to replace them:

```bash
ORVAL_INPUT=http://localhost:3001/docs-json pnpm generate:api
```

For that to be drop-in, the backend should expose these operations/schemas
(adjust names on either side to match):

| Operation (tag `edge-nodes`)       | Route                         |
|------------------------------------|-------------------------------|
| `EdgeNodesController_create`       | `POST   /edge-nodes`          |
| `EdgeNodesController_listNodes`    | `GET    /edge-nodes`          |
| `EdgeNodesController_revokeNode`   | `POST   /edge-nodes/{id}/revoke` |

`EdgeNodeResponse` telemetry assumed (named after `GET /edge/info`):
`id, restaurantId, branchId, branchName, name, status (ONLINE | OFFLINE |
SYNC_BACKLOG | NEEDS_UPDATE), lastHeartbeatAt, lastConfigSyncedAt,
lastOperationalPushAt, pendingCount, appVersion, schemaVersion,
expectedSchemaVersion, revokedAt, createdAt`. `RegisterEdgeNodeDto` =
`{ branchId, name }`; `RegisterEdgeNodeResponse` = `{ id, branchId, name, token }`
(token returned once). If the backend computes `status` server-side, the UI
already derives it from telemetry, so either is fine. `EDGE_MANAGE` is the
restaurant-wide permission assumed for these endpoints.

## Verification

The Node/pnpm tree in this sandbox is not fully readable (the mounted
`node_modules` symlinks and several large committed source files are served
**truncated** — e.g. `tsc` sees the existing `branches.ts`, the `model/*`
interfaces, and react-query's own `.d.ts` as corrupted), so a full-project
`pnpm typecheck && pnpm lint` could not be completed here.

What was verified:
- A **scoped `tsc --noEmit`** over the Hubs feature's import closure (with the
  handful of truncated dependency files restored to their true content) parses
  every new file with **zero syntax errors**. The only remaining diagnostics are
  `TS7006/TS7031/TS2339` on react-query generics — **reproduced by a one-line
  probe that uses `@tanstack/react-query` types directly with none of this
  feature's code**, confirming they come from the sandbox's truncated react-query
  type definitions, not from this code. The hand-authored `edge-nodes.ts`
  mirrors the committed `branches.ts` patterns exactly.
- `messages/{en,ru,hy}.json` parse as valid JSON, share an identical `hubs` key
  set, and all carry `nav.hubs`.
- `messages/en.json` was found truncated on disk inside its `inventory`
  namespace; its missing tail was reconstructed from the complete ru/hy
  structure (placeholders preserved) before adding the `hubs` namespace, so the
  English locale is valid and complete again.

Please run `pnpm typecheck && pnpm lint` (and `pnpm dev`) in your environment to
confirm against the real dependency tree.
```bash
ORVAL_INPUT=http://localhost:3001/docs-json pnpm generate:api   # replace stand-ins
pnpm lint
pnpm typecheck
pnpm dev    # http://localhost:4001
```
