# E2E-1 — Step 1: Inspect & Report

Order Lifecycle UI Bot (QR → POS → KDS). Findings only — no test code yet. All
claims below are grounded in the source with `file:line` references and were
spot-verified directly.

---

## TL;DR — three decisions that change the plan

The brief makes three assumptions that the code contradicts. None is a hard stop,
but each forces a concrete choice **before** the harness is written.

1. **"known PINs to target" — FALSE.** Staff PINs are minted with
   `randomInt(0, 1_000_000)` on every seed run and only *printed to stdout*; they
   are not deterministic and not stored anywhere queryable
   (`api/.../device-secret.util.ts:27-29`, `api/prisma/seed/modules/04-iam.ts:104`).
   Same for the device secret (`05-devices.ts`). → **The test cannot rely on the
   stock seed for auth.** See [Area 2](#area-2--auth-bootstrap-highest-risk) for the
   recommended path (provision a deterministic device+PIN in E2E global-setup, or
   mint JWTs via the API and inject them directly).

2. **"do NOT seed the order" is fine, but the seed *does* pre-create 16 orders** and
   occupies tables t1–t5 (`api/prisma/seed/modules/11-orders.ts`). → Use the one
   **unused table, `t6`**, for the UI-created order so it doesn't collide.

3. **"status flows back … (POS and/or QR)" — the QR app has NO WebSocket.** The
   customer app has no `socket.io-client` at all; it learns status by **polling
   `GET /public/order-requests/:id` every 4 s**, and only ever sees the *request*
   status `PENDING → CONFIRMED/REJECTED` — never `PREPARING/READY/SERVED`. KDS
   completion is **not** propagated to the customer. → The "kitchen completion
   propagates back" assertion must be made on **POS** (real WebSocket pushes
   `order.updated` / `order.ready`), not on the QR screen. The QR screen can only
   prove the **confirm** handoff (poll flips to `CONFIRMED`).

A fourth, smaller one: **no table has a QR token.** `qrIdentifier` is left `null` by
the seed, so there is no `?qr=` value out of the box — global-setup must assign one.

---

## Area 1 — Environment / URLs

Single origin behind Tailscale + nginx, path-routed under `/res/*` (`DEPLOY.md`).

| App      | basePath     | Port | URL |
| -------- | ------------ | ---- | --- |
| API      | `/res/api`   | 5200 | `https://msi.tail8514ca.ts.net/res/api` |
| website  | `/res`       | 4000 | `https://msi.tail8514ca.ts.net/res` |
| admin    | `/res/admin` | 4001 | `https://msi.tail8514ca.ts.net/res/admin` |
| **POS**  | `/res/pos`   | 4002 | `https://msi.tail8514ca.ts.net/res/pos` |
| **KDS**  | `/res/kds`   | 4003 | `https://msi.tail8514ca.ts.net/res/kds` |
| **QR/customer** | `/res/m` | 4004 | `https://msi.tail8514ca.ts.net/res/m/<slug>?qr=<qr>` |

- **QR entry URL** (the bit the customer scans):
  `…/res/m/tavern-ararat?qr=<token>`. Slug = path segment 0, read client-side via
  `usePathname()` (`customer/src/lib/tenant.ts:23-26`) and forwarded as the
  `X-Restaurant-Slug` header (`customer/src/api/mutator.ts:44-50`); `qr` = the table
  token from `?qr=` (`tenant.ts:59-64`).
- Socket.IO: host path `/res/socket.io` → nginx rewrites to backend `/socket.io`.
  The realtime namespace is **`/realtime`** (`api/.../realtime.gateway.ts:44`).
- `NEXT_PUBLIC_*` are **build-time inlined** — rebuild a frontend after changing its
  env. For the test we target the deployed Tailscale host (or run each app locally
  on its pinned port with the same envs).

**Decision for harness:** Playwright `baseURL` differs per project. Either give each
device-project its own `baseURL` (`…/res/pos`, `…/res/kds`, `…/res/m`) or one host
`baseURL` and navigate to full paths. Per-project baseURL is cleaner (see Step 2).

---

## Area 2 — Auth bootstrap (HIGHEST RISK)

### How the auth model actually works

Two layers (POS & KDS identical model):

1. **Device secret** — 64-hex token, minted server-side at enrollment
   (`POST /devices`, `devices.controller.ts:41`), returned in plaintext **once**.
   The server stores only `sha256(secret)`. The login guard does a **plain
   sha256-compare**: `findActiveBySecretHash(hashDeviceSecret(secret))`
   (`device-secret.guard.ts:24`). **There is no per-device signing or binding** — any
   secret whose sha256 matches an `ACTIVE` `devices` row is accepted. *This is what
   makes pre-seeding a known secret possible.*
2. **6-digit PIN** — staff picks themselves + enters PIN; exchanged at
   `POST /auth/pin-login` (`pin-auth.controller.ts:50`, body
   `{ deviceSecret, userId, pin }`) for a normal JWT
   (`{ accessToken, refreshToken, expiresIn, user, branchId, mustRotate }`).

### Where state lives (exact shapes)

**POS device secret** — `pos/src/lib/device/deviceSecretStore.ts`
- IndexedDB **`pos-device`** v1, store **`kv`** (no keyPath), key **`device-secret`**,
  value = **the raw secret string**. `store.put(secret, 'device-secret')` (:145);
  boot read `store.get('device-secret')` (:120), accepted iff non-empty string.

**KDS device secret** — `kds/src/lib/device/secretStorage.ts`
- IndexedDB **`kds-device`** v1, store **`kv`**, **two keys**: **`deviceSecret`**
  (string) and **`deviceSurface`** (string, e.g. `'KDS'`). Two puts at :80-81.

**Tokens after PIN login (localStorage, zustand-persist):**
- POS → `pos-auth` `{"state":{"accessToken","refreshToken","user"},"version":0}`
  (`pos/src/stores/auth.ts:51`) + `pos-branch`
  `{"state":{"activeBranchId"}}` (`stores/branch.ts:41`).
- KDS → `kds-auth` (`kds/src/lib/auth/store.ts:107`, persists
  `accessToken, refreshToken, user, permissions, allBranches, accessibleBranches,
  defaultBranchId`) + `kds-branch` `{branchId, branchName}` + `kds-station`
  `{station}` (without the last two the board is blocked by `StationPicker`,
  `kds/src/app/page.tsx:48`).

### Boot guards (what must be present before first render)

- **POS** gate chain `DeviceEnrollmentGate → AuthGate → BranchGate`
  (`pos/src/providers/Providers.tsx:37`). No IDB secret → enrollment screen only.
  No `pos-auth.accessToken` → redirect `/login`. Needs an accessible
  `activeBranchId`.
- **KDS** `login/page.tsx` checks `deviceHydrated`/`enrolled`/`isAuthed`; board wraps
  in `RouteGuard` + requires `branchId && station` + `KDS_ACCESS` permission.
- Both stores gate on a `hydrated` flag, so injected state must exist **before** the
  first hydration read → inject via Playwright `context.addInitScript` (or seed the
  IDB/localStorage then load).

### ✅ Recommended recipe (clean path exists)

Because the device secret is only sha256-compared and PIN-login is a plain HTTP
endpoint, the cleanest, least-flaky path is **API-mint + storage-inject**, done once
in Playwright **global-setup**, per app:

1. **Provision a deterministic device** (one-time, in global-setup):
   choose `const SECRET = '<64 hex>'`; insert/ensure a `devices` row with
   `surface='POS'` (and another `'KDS'`), `branchId = <flagship>`,
   `deviceSecretHash = sha256(SECRET)`, `status='ACTIVE'`. Either via a tiny SQL/
   Prisma step, or by driving `POST /devices` once with a manager JWT
   (manager login below) and capturing `result.secret`.
2. **Set a known PIN** for the chosen staff (so we don't depend on the random seed
   PIN): call the staff-pin use-case/endpoint, or read the printed PIN from the seed
   run. (A deterministic E2E setup that sets its own PIN is the robust choice.)
3. **Mint JWTs** with `POST /auth/pin-login { deviceSecret: SECRET, userId, pin }`.
4. **Inject storage** before navigation:
   - POS: IDB `pos-device/kv/device-secret = SECRET`; localStorage `pos-auth`,
     `pos-branch` from the JWT response.
   - KDS: IDB `kds-device/kv` → `deviceSecret=SECRET`, `deviceSurface='KDS'`;
     localStorage `kds-auth`, `kds-branch`, `kds-station`.
5. Navigate to `/` → gates pass, app renders authenticated. **No PIN UI needed.**

> Alternative (slower, exercises real UI): inject only the device secret, navigate,
> then drive the on-screen PIN keypad. POS supports `page.keyboard.type(pin)`
> (hardware-key listener); **KDS keypad is click-only** (`getByRole('button',{name:'1'})`).
> Use this for one optional "real login" smoke; use injection for the golden-path
> harness to avoid flakiness.

**This is the single biggest harness decision.** It is solvable, but it depends on a
deterministic device-secret + PIN that the stock seed does **not** provide, so
global-setup must create them. (Manager for any manual enroll step:
`gor.hakobyan@tavern-ararat.am` / `ChangeMe123!`, has `DEVICE_ENROLL`.)

---

## Area 3 — Seed dependency (deterministic fixtures)

- **uuidv5 confirmed.** Hand-rolled RFC-4122 v5 in `api/prisma/seed/ids.ts`,
  namespace **`6f9619ff-8b86-d011-b42d-00cf4fc964ff`**, `seedId(slug)=sha1(ns+slug)`.
  All "config" rows (org/restaurant/branch/role/user/table/category/menu/modifiers)
  are deterministic. Rows created via use-cases (**orders, PINs, device secrets,
  payments**) get random cuids each run.
- **Run:** `cd api && pnpm docker:up && pnpm prisma:deploy && pnpm db:seed`
  (entry `api/prisma/seed.ts`; `pnpm db:seed` — *not* `pnpm prisma:seed`). Keep
  `APP_MODE=CLOUD`. Required env: `DATABASE_URL`, `JWT_*_SECRET`, `PLATFORM_JWT_*`.

**Fixtures to target (computed deterministic UUIDs):**

| Entity | Value / ID |
| --- | --- |
| Restaurant **slug** | **`tavern-ararat`** (id `5859d0ea-5426-528e-9f18-b9227c9406a8`) |
| Branch (flagship) | `yerevan-kentron` → `84d3ed71-89e7-5ef9-8557-3e2354ba74d0` |
| **Target table** | **`t6` — Պատշգամբ 2** → `adc98859-6fa3-53d6-8c46-ed427ebd3ed1` *(only table with no seeded order)* |
| **Dish w/ required modifiers** | **Pork khorovats** `be6cc596-4305-51c4-9e30-9a09a3f50244`, 3500 AMD |
| → required group 1 | **Doneness** (`required:true`, single) → pick **Medium** `dfacc7ff-a732-5493-b0e9-c3c9129b046c` |
| → required group 2 | **Side** (`requiredOverride:true` on this dish) → pick **Fries** `57159739-093e-5e2f-9dfc-a5ba9d7f665a` |
| Simpler single-required alt | **Armenian coffee** `074f90ef-…` → Size (required) Small/Large |
| **POS staff (waiter)** | Դավիթ Սարգսյան `564d6d75-374f-5353-8431-e3c52aca61ab` (WAITER@flagship) |
| **KDS staff (kitchen)** | Հայկ Մկրտչյան `3415c97d-5a8c-5cb4-a58e-28876ec6e3ea` (KITCHEN_STAFF@flagship) |

**Caveats (both already flagged in TL;DR):**
- **No `qrIdentifier`** is set on any table (`10-reservations.ts` omits it) → assign
  a token to `t6` in global-setup before building the `?qr=` URL. Backend resolves it
  via `ResolvePublicTableUseCase` → `tableByQr(restaurantId, qrIdentifier)`.
- **PINs random per run** (printed to seed stdout) → set a known PIN in setup.
- Seed pre-creates 16 orders (Phase 11); `t6` is the clean, unused table.

---

## Area 4 — Selectors on the critical path

**There are zero `data-testid`s on the critical path in any of the three apps.** Today
only role-based selectors exist, and most rely on translated (i18n) or data-dependent
accessible names — fragile. Elements that should get a **`data-testid`** in Step 2
(scoped exactly to the critical path, no blanket sweep):

**Customer (QR):**
1. Menu-loaded sentinel — none today (`MenuView.tsx:248/265`).
2. Dish card button (`ItemCard.tsx:30`) — only data-dependent name.
3. Modifier option input (`ModifierPicker.tsx:70`) — radio/checkbox, no id/aria-label.
4. Add-to-cart button (`ItemDetailSheet.tsx:141`) — translated + price in name.
5. Open-cart button (`CartBar.tsx:24`) — translated + badge in name.
6. Place-order button (`CartView.tsx:151`) — name mutates to "placing…" while pending.
7. Order-confirmed indicator (`OrderStatusScreen.tsx:41`) — translated `<h1>`.
   *(Item sheet & cart are `role="dialog"` — usable as-is.)*

**POS:**
8. Confirm button on the order-request card (`OrderRequestCard.tsx:90`) — only
   `getByRole('button',{name:/confirm/i})` (translated). Reject at `:80`.
9. Pending-requests panel / new-order indicator (`OrderRequestsPanel.tsx`).

**KDS:**
10. **Start** (`TicketItemRow.tsx:51`), **Ready** (`:56`), **Mark order ready**
    (`TicketCard.tsx:128`), **Bump** (`:118`) — all translated text only.
11. Ticket card / order identity on the board (`TicketCard.tsx`) — to locate the
    specific new ticket among seeded ones.

Recommended convention: `data-testid` such as `dish-card`, `modifier-option`,
`add-to-cart`, `open-cart`, `place-order`, `order-confirmed`,
`request-confirm`, `kds-ticket`, `kds-item-start`, `kds-item-ready`,
`kds-order-ready`. (Plus the seeded entity id where a row must be uniquely located.)

---

## Area 5 — Order / KDS state machine (real names)

Three distinct lifecycles (`api/prisma/schema.prisma`):

- **CustomerOrderRequest** (`schema.prisma:994`): `PENDING → CONFIRMED | REJECTED`.
  The QR customer creates a **request**, not an Order.
- **Order** (`schema.prisma:678`): `DRAFT → SENT_TO_KITCHEN → PREPARING → READY →
  SERVED → CLOSED` (+ `CANCELLED`). Status is **derived** from item statuses
  (`order.ts:724`).
- **OrderItem** (`schema.prisma:688`): `NEW → SENT → PREPARING → READY → SERVED`
  (+ `CANCELLED`) — what KDS actually drives.

**Mapped to the brief's steps and the exact controls:**

| Brief step | Real transition | UI control | Endpoint |
| --- | --- | --- | --- |
| pending (customer) | `CustomerOrderRequest=PENDING` | QR **Place order** | `POST /public/order-requests` |
| waiter-confirmed | request `→CONFIRMED`, **creates Order + sends to kitchen** | POS **Confirm** on request card (`OrderRequestCard.tsx:90`) | `POST /order-requests/{id}/confirm` |
| KDS received | item `SENT`, ticket appears | (automatic on confirm) | — |
| **accept / start** | item `SENT→PREPARING` | KDS **Start** (`TicketItemRow.tsx:51`) | `POST /kds/order-items/{id}/preparing` |
| preparing | (item PREPARING) | — | — |
| ready/complete | item `→READY` (or whole order) | KDS **Ready** (`:56`) / **Mark order ready** (`TicketCard.tsx:128`) | `POST /kds/order-items/{id}/ready` · `POST /kds/orders/{id}/ready` |
| (bump) | local only, hides ticket | KDS **Bump** (`TicketCard.tsx:118`) | *no API call* |

**Important naming corrections vs the brief:** there is **no KDS "accept" step** —
SENT items are picked up directly with **Start**. **SERVED is a POS action**
(`MarkOrderServedUseCase`), not a KDS control. **Bump** is purely client-side. The
golden path's "accept → preparing → ready/complete" maps to **Start → (PREPARING) →
Ready / Mark order ready**.

---

## Area 6 — Real-time channels (assert push, no reload)

Single Socket.IO namespace **`/realtime`**; rooms = branch
`restaurant:<r>:branch:<b>` and station `…:station:<S>`. Domain events are relayed by
`api/src/modules/realtime/application/realtime-relay.ts`; payloads are id-only,
clients refetch over HTTP on receipt.

| Handoff | Channel | Event → who listens |
| --- | --- | --- |
| New QR order → **POS** | **WebSocket push** | `order_request.new` (branch room) → `OrderRequestsBell.tsx:29` invalidates pending list |
| POS confirm → **KDS** | **WebSocket push** | `kds:ticket.new` (station room) → `useBoardTickets.ts:57` refetch; also `order.updated` to branch |
| KDS Start/Ready → **POS** | **WebSocket push** | `order.updated` (branch) → `OrderBuilder.tsx:43`; on READY `order.ready` → `OrderReadyNotifier.tsx:16` |
| Any handoff → **QR customer** | **POLLED, no socket** | `GET /public/order-requests/:id` every 4 s (`OrderStatusScreen.tsx:19`); sees only `CONFIRMED/REJECTED` |

So for the golden-path assertions: steps 2, 4, 6-to-POS use **web-first auto-waiting
on a pushed UI change** (no reload, generous timeout). The **back-to-customer**
assertion is poll-based and limited to `CONFIRMED` — assert that on the QR screen
after waiter-confirm, and assert **kitchen completion on POS** (`order.ready` /
`order.updated`). Notable gap: `orders.order.served` has **no** relay handler — SERVED
is not pushed; don't assert it over WebSocket.

---

## Net effect on Steps 2–4

- **Harness (Step 2)** must include a **global-setup** that: (a) ensures a
  deterministic POS device + KDS device (known secret), (b) sets a known PIN for the
  two staff (or mints JWTs directly), (c) assigns a `qrIdentifier` to table `t6` and
  derives the `?qr=` URL, (d) produces injected IndexedDB + localStorage state per
  app. Three device-emulated projects (QR=Pixel-class mobile, POS=iPad-class tablet,
  KDS=desktop), per-project `baseURL`, trace+video ON.
- **Add data-testids (Step 2)** to the ~11 critical-path elements listed in Area 4.
- **Golden path (Step 3)**: create the order on **t6** with **Pork khorovats +
  Medium + Fries**; assert POS via `order_request.new` push; confirm; assert KDS via
  `kds:ticket.new` push; **Start → Ready**; assert completion **on POS** via
  `order.updated`/`order.ready` push, and assert **`CONFIRMED`** on the QR poll.
- **Run (Step 4)**: seed first (`pnpm db:seed`), run global-setup, then the spec;
  headed at least once; confirm per-device trace/video artifacts.

### Open question for you
The PIN/device non-determinism means global-setup must write some state into the
running system. Preference:
**(A)** add a small deterministic E2E seed/setup step (own device secret + fixed PINs
+ `t6` qr token) — most robust; or
**(B)** keep the stock seed and have global-setup call the API at runtime (manager
login → enroll device → set PIN → mint JWT → assign qr token) — zero seed changes,
slightly more setup code. Recommend **(A)** for determinism; **(B)** if the seed must
stay untouched.
