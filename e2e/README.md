# Restaurant OS E2E

Standalone Playwright Test workspace for cross-app checks. It belongs to no
single app and targets the public HTTPS Tailscale URLs exposed by NGINX.

## Real Topology

Admin/frontend PC:

- Host: `admin.tail8514ca.ts.net`
- IP: `100.86.82.60`
- Serves website, admin, and POS
- Public routes:
  - `https://admin.tail8514ca.ts.net/res`
  - `https://admin.tail8514ca.ts.net/res/admin`
  - `https://admin.tail8514ca.ts.net/res/pos`
  - `https://admin.tail8514ca.ts.net/res/api`
  - `https://admin.tail8514ca.ts.net/res/socket.io`

Display/customer PC:

- Host: `desktop-e60k825.tail8514ca.ts.net`
- IP: `100.68.186.15`
- Serves KDS and customer QR menu
- Public routes:
  - `https://desktop-e60k825.tail8514ca.ts.net/res/kds`
  - `https://desktop-e60k825.tail8514ca.ts.net/res/m/<slug>?qr=<qr>`
  - `https://desktop-e60k825.tail8514ca.ts.net/res/api`
  - `https://desktop-e60k825.tail8514ca.ts.net/res/socket.io`

Backend PC:

- Host: `msi.tail8514ca.ts.net`
- IP: `100.121.59.42`
- Runs NestJS on port `5200`
- Runs Socket.IO on backend path `/socket.io`

Browser E2E tests must use the public HTTPS URLs above, not local NGINX target
ports such as `4000`, `4001`, `4002`, `4003`, `4004`, or `5200`.

## Environment

`e2e/config/env.ts` loads `e2e/.env.e2e` if present, then falls back to the real
Tailscale topology. Explicit environment variables always win.

Start from the portable example:

```bash
cp .env.e2e.example .env.e2e
```

Example `e2e/.env.e2e`:

```dotenv
E2E_ADMIN_ORIGIN=https://admin.tail8514ca.ts.net
E2E_DISPLAY_ORIGIN=https://desktop-e60k825.tail8514ca.ts.net
E2E_BACKEND_ORIGIN=https://admin.tail8514ca.ts.net

E2E_WEBSITE_BASE_URL=https://admin.tail8514ca.ts.net/res
E2E_ADMIN_BASE_URL=https://admin.tail8514ca.ts.net/res/admin
E2E_POS_BASE_URL=https://admin.tail8514ca.ts.net/res/pos

E2E_KDS_BASE_URL=https://desktop-e60k825.tail8514ca.ts.net/res/kds
E2E_CUSTOMER_BASE_URL=https://desktop-e60k825.tail8514ca.ts.net/res/m
E2E_CUSTOMER_URL_TEMPLATE=https://desktop-e60k825.tail8514ca.ts.net/res/m/{slug}?qr={qr}

E2E_API_BASE_URL=https://admin.tail8514ca.ts.net/res/api
E2E_API_HEALTH_PATH=/health
E2E_SOCKET_BASE_URL=https://admin.tail8514ca.ts.net
E2E_SOCKET_PATH=/res/socket.io

E2E_ADMIN_API_BASE_URL=https://admin.tail8514ca.ts.net/res/api
E2E_ADMIN_SOCKET_BASE_URL=https://admin.tail8514ca.ts.net
E2E_DISPLAY_API_BASE_URL=https://desktop-e60k825.tail8514ca.ts.net/res/api
E2E_DISPLAY_SOCKET_BASE_URL=https://desktop-e60k825.tail8514ca.ts.net

E2E_FIXTURES_PATH=fixtures/seeded.json
```

Defaults are derived as follows:

- website: `${E2E_ADMIN_ORIGIN}/res`
- admin: `${E2E_ADMIN_ORIGIN}/res/admin`
- POS: `${E2E_ADMIN_ORIGIN}/res/pos`
- KDS: `${E2E_DISPLAY_ORIGIN}/res/kds`
- customer: `${E2E_DISPLAY_ORIGIN}/res/m`
- customer QR template: `${E2E_DISPLAY_ORIGIN}/res/m/{slug}?qr={qr}`
- API: `${E2E_BACKEND_ORIGIN || E2E_ADMIN_ORIGIN}/res/api`
- API health path: `/health`
- socket base: `${E2E_BACKEND_ORIGIN || E2E_ADMIN_ORIGIN}`
- socket path: `/res/socket.io`
- admin API proxy: `${E2E_ADMIN_ORIGIN}/res/api`
- admin socket proxy: `${E2E_ADMIN_ORIGIN}`
- display API proxy: `${E2E_DISPLAY_ORIGIN}/res/api`
- display socket proxy: `${E2E_DISPLAY_ORIGIN}`

The backend currently exposes health at `GET /health`
(`api/src/modules/health/presentation/http/health.controller.ts`). If the backend
route changes, update `E2E_API_HEALTH_PATH`; the E2E suite does not invent a
health endpoint.

`E2E_API_BASE_URL` and `E2E_SOCKET_BASE_URL` remain the primary/default targets
for normal API tests and session setup. The admin/display proxy variables are
checked by the `health` and `all-flow` projects because both frontend NGINX
entrypoints are expected to proxy API and Socket.IO in this deployment.

## Seeded Fixtures

The POS, KDS, customer, and all-flow tests use deterministic fixtures from
`e2e/fixtures/seeded.json`. This file must exist on whichever PC runs the E2E
tests. The E2E commands do not run seed/reset automatically because the test
runner may be a different Tailscale machine from the backend.

To create the file on a machine that has the API workspace and database access,
run the seed manually:

```bash
cd ../api
pnpm db:seed
pnpm db:seed:e2e
```

Then copy `e2e/fixtures/seeded.json` to the same path on any other PC that will
run POS, KDS, customer, or all-flow tests. App-specific smoke tests skip when
those fixtures are absent. The full flow fails clearly because it cannot run
without them.

KDS smoke uses the real KDS UI login path with the seeded KDS fixture: the test
uses the fixture's enrolled KDS device secret as the local device anchor, selects
the seeded KDS staff member in the UI, enters the seeded PIN through the keypad,
pins the station, and then checks the board. It does not inject authenticated KDS
localStorage by default because that storage contract can drift from the
frontend. Owner email/password login is not the main KDS E2E path.

If POS/KDS reports `INVALID_PIN` or `PIN_LOCKED`, the local fixture may not match
the backend DB behind `E2E_API_BASE_URL`, or the dev E2E PIN may be locked. Get a
fresh `e2e/fixtures/seeded.json` from the backend/dev DB owner, or ask the
backend owner to refresh or unlock the dev E2E PIN state. Do not repeatedly rerun
POS/KDS after `INVALID_PIN`; repeated invalid attempts can cause lockout. The E2E
tests themselves do not reset backend lockout state.

## Running From Any PC

These tests are portable across any machine connected to the same Tailscale
network. They must not depend on being run from the PC that hosts a given app.

1. Install Node and pnpm.
2. Clone or copy this repo.
3. Open a shell in `e2e/`.
4. Copy `.env.e2e.example` to `.env.e2e` and adjust only if your public Tailscale
   URLs differ.
5. Make sure Tailscale is connected:

```bash
tailscale status
```

6. Verify the public routes from that PC:

```bash
curl -k -I https://admin.tail8514ca.ts.net/res
curl -k -I https://desktop-e60k825.tail8514ca.ts.net/res/kds
curl -k -I https://admin.tail8514ca.ts.net/res/api/health
```

7. Install and run:

```bash
pnpm install
pnpm install:browsers
pnpm e2e:health
pnpm e2e:pos
pnpm e2e:kds
pnpm e2e:all
```

All browser/API tests use public HTTPS Tailscale URLs. They do not use
`localhost`, `127.0.0.1`, or local NGINX upstream ports.

## Commands

Run from this `e2e/` directory with pnpm:

```bash
pnpm install
pnpm install:browsers

pnpm e2e:health
pnpm e2e:api
pnpm e2e:website
pnpm e2e:admin
pnpm e2e:pos
pnpm e2e:pos-requests
pnpm e2e:kds
pnpm e2e:kds-ticket
pnpm e2e:customer
pnpm e2e:customer-order
pnpm e2e:mobile
pnpm e2e:all
```

`pnpm e2e` runs every project. `pnpm test:headed` runs Playwright headed, and
`pnpm report` opens the HTML report from `artifacts/html`.

## Projects

- `health`: preflight checks for API, app routes, and Socket.IO polling.
- `api`: non-mutating API health.
- `website`: public website route smoke; does not depend on admin/POS/KDS/customer.
- `admin`: admin route smoke; authenticated checks require explicit credentials.
- `pos`: POS route + primary API/session requirements; does not require KDS/customer.
- `pos-requests`: focused POS -> API connection test. It creates one pending
  public customer order request through the API, opens authenticated POS, finds
  that exact request card, confirms it, and verifies the API marks it confirmed
  and removes it from the pending staff list.
- `kds`: KDS route + primary API/socket requirements, then real KDS UI staff/PIN
  login from the seeded fixture; does not require POS/customer.
- `kds-ticket`: focused KDS -> API connection test. It creates a public customer
  order request through the API, confirms it with the seeded POS API session,
  opens authenticated KDS, finds that exact ticket/item, marks it preparing and
  ready from the board, and verifies the KDS API status after each action. To
  keep reruns independent, it clears only active orders on the seeded E2E table
  before/after the test using the standard seeded owner API account.
- `customer`: customer QR route + primary API requirements.
- `customer-order`: focused customer QR -> public API connection test. It opens
  the seeded table QR menu, adds the seeded dish, places a request, asserts the
  customer status UI, and verifies `GET /public/order-requests/:id`.
- `mobile-reservation`: skipped placeholder; this repo contains an Expo Android
  app under `mobile-reservation/android-missed-call-sync`, not a browser route.
- `all-flow`: full customer QR -> POS -> API -> KDS -> POS/customer propagation.

App-specific projects intentionally avoid whole-topology checks. For example,
`pnpm e2e:pos` should not fail just because the display PC is offline unless the
POS test itself starts depending on a display-hosted service. Use
`pnpm e2e:health` for whole-deployment topology checks.

## Full Flow

The all-flow test first checks:

- primary API health at `E2E_API_BASE_URL + E2E_API_HEALTH_PATH`
- website/admin/POS on the admin PC
- KDS/customer on the display PC
- API through the admin proxy at `E2E_ADMIN_API_BASE_URL + E2E_API_HEALTH_PATH`
- API through the display proxy at `E2E_DISPLAY_API_BASE_URL + E2E_API_HEALTH_PATH`
- Socket.IO polling through the admin proxy
- Socket.IO polling through the display proxy

Frontend route checks use a fresh request context per route, send `HEAD` first
with redirects disabled, and accept any status below `500`. If `HEAD` is not
supported, the check falls back to `GET` with the same redirect and status
rules. API health and Socket.IO polling checks remain strict.

It then mints POS/KDS sessions through the API for the cross-app flow, injects
localStorage for the correct browser origin, writes the POS/KDS device secrets to
IndexedDB, and runs the order lifecycle. The standalone KDS smoke test is
stricter about the frontend contract and uses the real KDS UI login path instead
of injected KDS auth localStorage.

## Common Failures

- Tailscale machine offline: the preflight error names the exact URL.
- NGINX route missing: frontend or Socket.IO URL returns 404/502.
- Frontend redirect/auth behavior: frontend reachability checks use `HEAD`
  first, do not follow redirects, do not share cookies between routes, and treat
  any status below 500, including `301`, `302`, `307`, `308`, `401`, and `403`,
  as reachable.
- API proxy wrong: `E2E_API_BASE_URL + E2E_API_HEALTH_PATH` fails.
- Proxy-specific API route wrong: `E2E_ADMIN_API_BASE_URL` or
  `E2E_DISPLAY_API_BASE_URL` fails with the configured health path.
- Socket.IO path wrong: polling endpoint at `/res/socket.io` fails.
- CORS issue: browser tests load but API calls fail in the page.
- Frontend not rebuilt: `NEXT_PUBLIC_*` values are build-time inlined.
- Missing seeded fixtures: create/copy `e2e/fixtures/seeded.json` onto the PC
  running Playwright. For `pnpm e2e:customer-order` and
  `pnpm e2e:pos-requests` / `pnpm e2e:kds-ticket`, the fixture must come from
  `pnpm db:seed` followed by `pnpm db:seed:e2e` so table `t6` has
  `e2e-tavern-ararat-t6`, customer ordering is enabled, the seeded POS session
  can confirm requests, and the seeded KDS session is pinned to `KITCHEN`.
  `pnpm e2e:pos-requests` requires API + DB, POS/frontend, and the Playwright
  E2E terminal; it does not require customer, KDS, or websocket delivery.
  `pnpm e2e:kds-ticket` requires API + DB, KDS/frontend, and the Playwright E2E
  terminal; it does not require customer/POS frontends or websocket delivery.
  If `SEED_STAFF_PASSWORD` was changed from the default, update the seeded-owner
  cleanup auth used by `pnpm e2e:kds-ticket` or rerun the seed with the default
  test password.
- `INVALID_PIN` or `PIN_LOCKED`: the fixture may not match the backend DB, or the
  dev E2E PIN may be locked. Stop rerunning POS/KDS after `INVALID_PIN`; ask the
  backend/dev DB owner for a fresh `fixtures/seeded.json` or refreshed/unlocked
  dev E2E PIN state. The E2E tests do not reset backend lockout state.
- KDS `No kitchen access`: the KDS route and NGINX can still be healthy. Check
  the seeded KDS user's permissions, fixture/backend DB alignment, and deployed
  KDS app version.
- KDS email/password login screen: the deployed app is not exposing the current
  device-enrollment/staff-PIN flow that `pnpm e2e:kds` exercises. Redeploy KDS
  from the current source or add a stable way to import/select an existing
  seeded KDS device for tests.
- Missing credentials: authenticated admin/website tests are intentionally not
  implemented until E2E credentials are provided.
- Mobile reservation: no browser route exists in this repo for Playwright.

## Selectors

POS and customer tests use existing `data-testid` selectors on the current
critical path. KDS board assertions use `data-testid="kds-board"`, but KDS login
currently relies on visible staff/station/button text because the staff picker,
PIN keypad, and station picker do not expose dedicated E2E selectors yet.
Recommended additions before expanding KDS coverage: `kds-staff-option`,
`kds-pin-key`, `kds-station-option`, and `kds-station-confirm`. Admin and
website do not currently expose stable E2E selectors, so their smoke tests only
assert that the app route renders a visible body.
