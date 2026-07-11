# AUDIT-1 — Current-State Inspection Findings (READ-ONLY)

_Inspection only. No files were written, edited, or generated in the repo. All anchors verified via grep/read of `api/src`, frontends, and `api/prisma/schema.prisma`._

---

## Section 0 — Repo & git ground truth

- Branch: **develop**. HEAD = `1eddc74` "Merge branch 'rescue/previous-adgcode' … into develop" — a rescue-branch merge sits at the tip.
- `git status --short`: **2000 entries** (1504 modified, 479 untracked, 17 deleted).
  - `// NOTE:` churn is ~83% noise: **1181/2000** mention `generated` (all under `*/src/api/generated` Orval clients); **41** are `.idea/*` IDE config; lockfiles/openapi round it out. Hand-written **backend** churn under `api/src` (non-generated) ≈ **215 files** — that plus frontend `src` is the real signal.
  - `// NOTE:` `api/openapi.json` is in a **dual state** — staged as deleted (`D`) yet present on disk untracked (`??`): git-rm'd from the index, then regenerated.
  - `// NOTE:` a `.git/index.lock` warning appears (consistent with the massive uncommitted generated-client churn never being committed).
- Top-level layout: `admin/` (Next.js admin, /res/admin), `api/` (NestJS backend, DDD under api/src), `customer/` (QR/web ordering), `customerapi/` (customer BFF), `customermobileapp/` (Expo app), `e2e/` (Playwright harness), `kds/` (Kitchen Display), `mobile-reservation/` (missed-call sync), `pos/` (POS), `website/` (marketing/signup). Plus `DEPLOY.md`, two `.pptx` overviews.
- OpenAPI spec: `api/openapi.json`, `admin/openapi.json`, `customer/openapi.json`. `// NOTE:` spec is **fresh, not stale** — `find api/src -name '*.ts' -newer api/openapi.json` = 0 matches; all three regenerated in lockstep (2026-07-10 01:12).

---

## Section 1 — BUGFIX-1 (POS live permission propagation)

1. **Identity-only JWT — PARTIAL (divergent from spec).** Token still snapshots permissions but they're ignored for authz. `api/src/shared/auth/jwt-payload.ts:10-18` `AccessTokenPayload = { sub, organizationId, restaurantId, branchId, roleId, permissions: string[] }`; built at `identity/application/services/auth-token-issuer.ts:40-47` ("SNAPSHOTS the user's current permissions").
2. **Server-side permission resolution — DONE.** `shared/auth/permissions.guard.ts:50-52` resolves fresh per-request: `request.effectivePermissions ?? await this.rolePermissions.get(org, roleId)` ("never trusts the JWT permission snapshot"). `GET /auth/me` also resolves live (`get-me.usecase.ts:50,60`).
3. **Redis cache + invalidation — DONE.** GET at `identity/infrastructure/services/role-permissions.cache.ts:31-34` (`redis.get(role:{roleId}:permissions)`, TTL 300s, DB fallback+re-cache). Invalidation inside update-role: `update-role.usecase.ts:43` `await this.rolePermissions.invalidate(role.id)` (before broadcast); `cache.invalidate` = `redis.del` (`:62-64`).
4. **Socket.IO event — DONE (emit + subscribe).** Domain event `role.ts:105 RolePermissionsUpdatedEvent`; server emit `realtime/application/realtime-relay.ts:177-179` `@OnEvent('identity.role.permissions_updated')` → `emitToOrg(org, 'role.permissions.updated', { roleId })`; POS subscribes `pos/src/lib/realtime/usePermissionsRealtimeSync.ts:19`.
5. **Client reactive invalidation — DONE.** Socket-driven `invalidateQueries(getAuthControllerMeQueryKey())` (`usePermissionsRealtimeSync.ts:19-21`) + `refetchOnWindowFocus: true` fallback (`pos/src/lib/useAuthMe.ts:21`), mounted app-wide via `PermissionsSync.tsx` in `Providers.tsx:46`. Permissions come from live `/auth/me`, not hydrated-once into zustand (`pos/src/stores/auth.ts` holds only the token).

`// NOTE:` **BUGFIX-1 is fully wired end-to-end.** Only spec divergence: the JWT still carries an (unused-for-authz) permission snapshot instead of being strictly identity-only.

---

## Section 2 — Branch ordering-config UI

1. `ORDERING_FLOW_NOT_PERMITTED` thrown at `table-sessions/domain/table-sessions.errors.ts:29` (HTTP 409), gated by `table-sessions/domain/ordering-flow.policy.ts:60-107` (`decideSessionStart`). Effective policy = restaurant ceiling AND branch config (branch may only narrow). `qrWebAllowed()` requires `restaurantOrderingEnabled && restaurantQrMenuEnabled && qrOrderingEnabled && prepaymentEnabled`.
2. Per-branch flags (`api/prisma/schema.prisma:234-237`, all default **false** except idle): `orderingPrepaymentEnabled`, `orderingPayAtEndEnabled`, `orderingQrEnabled`, `orderingIdleExpiryMinutes @default(150)`. Restaurant ceiling (`RestaurantSettings`): `enableQrMenu @default(true)`, `enableCustomerOrdering @default(false)`. Domain invariant (`ordering-config.ts:66`): `qrOrderingEnabled` requires `prepaymentEnabled`.
3. **Write endpoint EXISTS:** `restaurant/presentation/http/branches.controller.ts:145` `@Patch(':id/ordering-config')` → `update-branch-ordering-config.usecase.ts:23`.
4. **Admin UI PRESENT — gap CLOSED.** `admin/src/components/branches/branch-ordering-section.tsx:36` ("Wires the otherwise unused PATCH /branches/{id}/ordering-config"), hook `useBranchesControllerUpdateOrderingConfig`. Section locks unless restaurant `enableCustomerOrdering` is on; enabling QR forces prepayment on; `payAtEnd` toggle rendered but disabled ("no built consumer yet").

`// NOTE:` The documented gap is **closed** — admin UI now exists (labelled `BRANCH-ORDERING-UI`). To allow QR ordering a branch needs: restaurant `enableCustomerOrdering=true` (+`enableQrMenu=true`) **and** branch `orderingQrEnabled=true` **and** `orderingPrepaymentEnabled=true`.

---

## Section 3 — Fiscalization (e-HDM)

1. **e-HDM adapter — mTLS confirmed; 3DES-ECB NOT present.** `fiscalization/infrastructure/adapters/ehdm-fiscalization.adapter.ts` + transport `https-ehdm.transport.ts:29-34` (`new https.Agent({ cert, key, ca, rejectUnauthorized: true })`, verification never disabled). `// NOTE:` **The premised 3DES-ECB usage does not exist** — no `3DES`/`DESede`/`ECB` cipher anywhere in code; the electronic path is mTLS + JSON. 3DES appears only in forward-looking comments about the *future physical* HDM. Cert material: PEM via `fs.readFileSync` (`env-file-fiscal-config.adapter.ts:65-67`, keyed `<restaurantId>:<branchId>`) or DB (FISCAL-4); `.jks` is converted to PEM by ops, never parsed at runtime.
2. **Envelope encryption — CONFIRMED.** `fiscal-config/infrastructure/crypto/fiscal-crypto.service.ts:6` `ALGO='aes-256-gcm'`; per-tenant random 32-byte DEK wrapped by master KEK (`:76-82`), `kekVersion` for rotation. Master KEK read from **env** `FISCAL_MASTER_KEK` (`:39`), boot-validated 64-hex/32-byte; comment "KMS is the scale follow-up."
3. **adgCode placement — CONFIRMED at dish level.** `schema.prisma:570-575` `MenuItem.adgCode String? @map("adg_code")` ("ATG code belongs to the SOLD product (the dish), not its ingredients"); snapshotted to `OrderItem.adgCode` (`:920`). Fail-closed pre-flight `ehdm-protocol.ts:111-116` throws `192 ADG_CODE_REQUIRED` if null.
4. **Physical HDM (FISCAL-2) — PARKED, and the protocol library is ABSENT (not merely unwired).** No `net.Socket`/`createConnection`/TCP anywhere in `fiscalization`; only comments name the future work (`channel-router-fiscalization.adapter.ts:16`, `fiscalization.port.ts:44`). Router sends `QR_WEB`/`APP` → real eHDM, `POS`/default → **stub** (`stub-fiscalization.adapter.ts`).
5. **OFF-7 offline fiscalization — ABSENT.** `rg "OFF-7|offline.*fiscal"` in `api/src` = no matches (unrelated `shared/edge/` LAN pairing exists but is not fiscalization).
6. Hardcoded SRC endpoints: `ehdm-protocol.ts:15-16` `SRC_ROOT_PROD='https://ecrm.taxservice.am/taxsystem-rs-vcr'`, `SRC_ROOT_TEST='https://10.3.14.123:447'` (test IP present; `FISCAL-GO-LIVE-RUNBOOK.md` notes it needs VPN/allowlist).

---

## Section 4 — Core invariants

1. **Money integer minor units — DONE.** All schema money fields `Int` (`_amount` suffix), rates `Int` bps, inventory cost `lastUnitCostMicro BigInt`. No `Decimal`/`Float` type in schema. The only `Decimal` string matches are VO formatter methods (`money.ts:94 toDecimalString`, `quantity.ts`) used solely at the fiscal-device boundary — not storage/math.
2. **cuid2 runtime / uuidv5 seed-only — DONE.** `ID_GENERATOR` port → `CuidIdGenerator` (`identity.module.ts:167`), injected across orders/tables/identity/audit. `uuidv5` appears only under `api/prisma/seed/*` and `seed-e2e.ts`; none in `api/src`. `// NOTE:` minor — `catalog/application/services/catalog-import.service.ts:2` imports `createId` from cuid2 directly, bypassing the port (still cuid2; not a violation).
3. **DAG write-guard — DONE.** Detector `inventory/domain/services/process-graph-cycle.ts:84 detectProcessCycle` (self-ref + downward reachability, terminates on pre-existing cycles); guard `process-graph-cycle.checker.ts:39 assertAcyclic` called from `create-process.usecase.ts:50` and `update-process.usecase.ts:72`.
4. **Allergen resolution — DONE (all four properties).** Override precedence tenant>catalog>null at `platform-catalog/domain/allergen-precedence.ts:22-33` (by reference; denormalized copy is cache only); derived at read time (`catalog-resolution.service.ts:90-112`); display stops at produced-item name while allergens recurse to leaves (`dish-projection.resolver.ts:99-127`); unverified-leaf safety floor — `verified` requires `catalogSourced && allergensReviewed`, missing rows count unverified, no-recipe lines read `{ slugs: [], complete: false }`.
5. **Prepayment-only customer ordering — DONE.** QR-web capped to `PREPAYMENT` irrespective of requested flow (`ordering-flow.policy.ts:66-71`); app uses the same `CreatePrepaymentOrderUseCase` (`app-orders.controller.ts:101-108`); kitchen gated by `dispatchPrepaid()` → `PrepaymentNotSettledError` unless PAID. `// NOTE:` a `PAY_AT_END` value exists as dormant session-flow scaffolding (enum + branch column + "coming soon" admin label) with **no** customer order-creation path behind it — not a violation.

---

## Section 5 — Surface & workstream presence

- **Ordering core** — complete. `api/src/modules/table-sessions/` (31 files) + `orders/` (72 files, 29 usecases); customer QR-web cart wired. `// NOTE:` no live camera scanner (`getUserMedia`/`BarcodeDetector`/`jsQR` = 0 hits) — table binding is by QR-URL token, not a camera scan.
- **Catalog / recipe / modifier groups** — complete. `menu/` (modifier groups), recipes under `inventory/`, `catalog/` import/export layer.
- **Inventory (StockLayer/FIFO/costing)** — complete. `inventory/` (176 files, 48 usecases): StockLayer, goods-receipt/adjust/transfer/write-off, `cost-allocation.ts`, `order-consumption.listener.ts`.
- **IAM (PIN / device-anchor / step-up / capability)** — complete. `identity/` (115 files): PIN, step-up/manager-approval, capability grants; device-anchoring thinner but present.
- **Branch epic (BR-1..BR-10)** — complete (no literal `BR-n` tags). Branch membership entity/repo + `branch-scoped`/`active-branch` decorators; multi-branch scoping is real.
- **Offline epic (OFF-1..OFF-8)** — **partial/early-stage.** `edge-registry/` (29 files: snapshot + sync-push controllers, heartbeat, schema-version guard) + `edge-sync/` (8 files, `snapshot-applier.ts`, no controller/usecase). Scaffolding exists; sync application light; no offline-auth/hub-switching tags.
- **Consumer discovery** — mixed. Backend complete (`consumer/` 52 files + `consumer-identity/` 49 + `storefront/`); Expo app partial (ships `PHASE0_FINDINGS.md`); owner admin UI present (`admin/.../consumer-listing`).
- **Photo storage (R2 presigned)** — complete. `media/`: `presign-upload.usecase.ts`, `r2-object-storage.adapter.ts` (+ dev adapter).
- **Playwright E2E harness** — **stub in this checkout.** `e2e/` holds only `artifacts/`, `fixtures/seeded.json`, `.gitignore` — **zero spec files, no `playwright.config.*` anywhere in the repo**. Artifacts (`e2e/artifacts/html/index.html`) indicate it *ran* at some point, but no harness source is committed here. `// NOTE:` this contradicts the planning-note "QR→POS→KDS multi-context harness" — not present in this tree.
- **SEED-1 full restaurant seed** — complete. `api/prisma/seed/modules/` 14 ordered modules (`01-org` → `14-platform-catalog`) + `seed-e2e.ts` + `seed.edge.ts`.
- **Legal pages (PDPA)** — partial. `website/src/app/[locale]/legal/privacy/page.tsx` exists; no explicit PDPA-labelled content beyond a generic i18n privacy page.
- **Platform-admin panel** — complete; lives **inside** `admin/` (`admin/src/app/(platform)/platform/*`: catalog, fiscal-config, login), not a standalone app. Backend `platform/` (74 files) + `platform-catalog/` (20 files).

---

## Section 6 — Deployment (D1) readiness

- Artifacts: **one** hand-written `api/Dockerfile` (no Dockerfiles for admin/customer/pos/kds/website). `api/docker-compose.yml` is **infra-only** (postgres:16 + redis:7); `api/docker-compose.edge.yml` also exists. `DEPLOY.md` is a **manual runbook** (pnpm build/start per app behind nginx + Tailscale single host, path-based `/res/*`) — no container orchestration for the apps.
- Env templates present for api/admin/kds/website/pos/customer/customermobileapp. `api/.env.example` documents DATABASE_URL, REDIS_URL, JWT/PLATFORM/CONSUMER secrets, CORS, OTP, Nikita SMS, R2 storage.
- `// NOTE:` **`FISCAL_MASTER_KEK` is missing from `api/.env.example`** — it's the envelope-encryption master KEK, boot-required when `FISCAL_CONFIG_BACKEND=DB` (`env.schema.ts:266-342`, `fiscal-crypto.service.ts:39-57`). Template predates FISCAL-4. Also `STORAGE_DRIVER` must be `r2` in prod but all `R2_*` creds are blank; SMS creds blank (dev console stub).
- `// NOTE:` **No repo-level CI** (all `.github/workflows/*` hits are inside node_modules). No deploy logs. DEPLOY.md claims per-app `.env` files are "already populated for this host" (implies the Tailscale host was configured at least once), but nothing proves an automated D1 deploy ever executed. Playwright HTML report artifact proves the *e2e harness* ran, not D1.

`// NOTE:` D1 = **written-only** (manual runbook + infra compose exist; no evidence of an executed/automated deploy).

---

## Section 7 — Loose ends

- **TODO/FIXME/HACK — very few (~5), all in `api/src`, zero in frontends.** Cluster A (email stub): `identity/infrastructure/services/console-email.service.ts:6`, `identity/application/ports/email.service.ts:3` ("replace with real SMTP/SES"). Cluster B (`TODO(BR-7)` branch derivation): `order-requests/.../create-order-request.usecase.ts:68`, `reservations/.../create-reservation-from-call.usecase.ts:76`, `reservations/.../ingest-missed-calls.usecase.ts:20`.
- **Single-tenant `demo`/`{slug}` defaults — none remain.** `customer/src/lib/tenant.ts:73` explicitly: "deliberately NO fixed-tenant fallback"; the `NEXT_PUBLIC_RESTAURANT_SLUG=demo` var is commented out in `customer/.env.example:14`. Slug resolved from path / `X-Restaurant-Slug` header. Other `demo` hits are illustrative doc comments only.
- **e2e skipped/focused tests — none.** No `.skip(`/`.only(`/`.todo(` under `e2e/` — but that's because **there are no spec files at all** (see Section 5).
- **Dead/duplicated modules — none obvious.** The one structural oddity is the git-rm'd-then-regenerated `api/openapi.json` (Section 0).

---

## STATUS REPORT

### Git
- branch: **develop** (HEAD `1eddc74` = rescue/previous-adgcode merge)
- uncommitted files (count): **2000** — but ~83% is generated Orval clients (1181) + `.idea` (41) + lockfiles/openapi; real backend signal ≈ **215** files under `api/src`
- last 5 commits: `1eddc74` merge rescue/previous-adgcode · `bc3f24f` FISCAL-4-FE Fiscal Config UI · `7643ad5` ADGCODE-UI Menu-Item ATG entry · `2dbd61a` FISCAL-4-FE · `742068c` FISCAL-4 Per-Tenant Fiscal Config Storage

### Open threads
- BUGFIX-1: **DONE** — fully wired end-to-end (per-request resolution from Redis cache invalidated on role update → `role.permissions.updated` socket → POS `/auth/me` invalidate + focus-refetch); only divergence is the JWT still carries an unused permission snapshot vs. strictly identity-only.
- Branch ordering-config UI: **PRESENT** — gap closed; admin `branch-ordering-section.tsx` wires `PATCH /branches/{id}/ordering-config`. Flags needed for QR: restaurant `enableCustomerOrdering=true` (+`enableQrMenu`) and branch `orderingQrEnabled=true` + `orderingPrepaymentEnabled=true`.

### Fiscalization
- e-HDM adapter: **present, mTLS JSON over node:https** — but **3DES-ECB is NOT in code** (premise unconfirmed; 3DES only in future-work comments)
- envelope encryption: **DONE** — AES-256-GCM per-tenant DEK wrapped by master KEK from env `FISCAL_MASTER_KEK`
- adgCode placement: **DONE** — on `MenuItem` (dish), snapshotted to `OrderItem`, fail-closed pre-flight
- physical HDM (FISCAL-2): **absent** — not just unwired; no TCP/3DES library written; POS routed to stub adapter
- OFF-7: **absent** — no reference in `api/src`

### Invariants
- money integer: **DONE**
- cuid2/uuidv5: **DONE** (minor: `catalog-import.service.ts` uses cuid2 directly, bypassing the port)
- DAG guard: **DONE** (`assertAcyclic` on create/update-process)
- allergen resolution: **DONE** (override precedence + read-time derivation + depth-1 display + leaf recursion + unverified safety floor)
- prepayment-only: **DONE** (`PAY_AT_END` is dormant scaffolding, no customer order path)

### Surfaces (complete / partial / stub)
- Ordering core — **complete** (`api/src/modules/table-sessions` + `orders`); no live camera scanner (QR-URL token binding)
- Catalog/recipe/modifiers — **complete** (`menu` + `inventory` + `catalog`)
- Inventory (StockLayer/FIFO/costing) — **complete** (`api/src/modules/inventory`)
- IAM (PIN/device/step-up/capability) — **complete** (`api/src/modules/identity`)
- Branch epic — **complete** (branch membership + scoping decorators)
- Offline epic — **partial/early** (`edge-registry` + thin `edge-sync`; no offline-auth/hub-switching)
- Consumer discovery — **backend complete, Expo partial (PHASE0), owner UI present**
- Photo storage (R2) — **complete** (`api/src/modules/media`)
- Playwright E2E harness — **stub in this checkout** (`e2e/` has artifacts + fixtures but ZERO specs / no config)
- SEED-1 — **complete** (`api/prisma/seed/modules`, 14 modules)
- Legal (PDPA) — **partial** (generic privacy page, no PDPA-specific content)
- Platform-admin — **complete**, inside `admin/` (`(platform)/platform/*`), not standalone

### Deployment (D1): **written-only**
Manual runbook + infra compose + `api/Dockerfile` exist; no CI, no deploy logs, no evidence of automated execution. Prod-config gap: `FISCAL_MASTER_KEK` missing from `api/.env.example`; `R2_*` creds blank.

### Notable loose ends
- `api/openapi.json` in dual git state (staged-deleted + untracked-on-disk); `.git/index.lock` warning; 2000-entry uncommitted generated-client churn never committed.
- E2E harness source **absent** in this tree despite artifacts proving it ran — reconcile against planning notes (memory references a QR→POS→KDS harness that isn't committed here).
- `FISCAL_MASTER_KEK` undocumented in env template (boot-required for DB fiscal backend).
- Email delivery is a console stub (`console-email.service.ts` — TODO real SMTP/SES).
- `TODO(BR-7)` branch-derivation cluster in order-requests + reservations (QR code should carry its branch).
- JWT still carries an unused permission snapshot (BUGFIX-1 spec wanted identity-only).
- `catalog-import.service.ts` bypasses the `IdGenerator` port (uses cuid2 `createId` directly).
