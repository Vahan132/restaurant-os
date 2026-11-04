# EDGE-OFFLINE-UI — Serve POS/KDS/Admin from the hub (true offline)

**Status:** design / not yet implemented
**Goal:** when the internet is down, the on-prem hub serves the **frontends** (POS, KDS, Admin) *and* the API over the LAN, so staff can keep working. Cloud stays primary (faster) when online; the hub is the offline fallback; data resyncs when the internet returns.

## Decisions (locked)

1. **Apps served by the hub:** POS, KDS, Admin. (Customer QR-ordering and the marketing Website stay cloud-only for now.)
2. **Failover mechanism:** hub-served frontends **only** — no service worker / PWA. When offline, the device loads the app from the **hub's LAN URL** (`http://<hub>/res/<app>`). Cloud is used normally when online.
3. **Admin offline scope:** **operational-only** — day-to-day running of the one branch. Structural/config changes stay cloud-driven.

## Why this is needed (current gap)

- The hub (`docker-compose.edge.yml`) runs only `postgres` + `api`. It does **not** serve the POS/KDS/Admin web apps — those live only on the cloud droplet (website/admin/pos/kds/customer + nginx).
- The apps are **not** PWAs (no service worker), so a browser cannot load them from cache when offline.
- Result today: the "Local hub" toggle only repoints the **API** of an already-loaded app. A screen that is opened (or power-cycled) **while offline cannot load the app at all** — the browser can't fetch it from the cloud. Pointing at the hub by a **public domain** also fails offline (DNS needs the internet).
- What already exists and is reused unchanged: the data-sync machinery (edge snapshot bootstrap OFF-2, config pull OFF-3, operational push OFF-4, heartbeat OFF-8). This doc does **not** change data sync — only how the UI is served.

## Architecture

The hub becomes a **local mirror of the cloud stack** on the LAN:

```
docker-compose.edge.yml  (hub)
  postgres        (existing)
  api             (existing — APP_MODE=EDGE, one branch)
  nginx           (NEW — mirrors cloud /res/* path routing, same-origin)
  pos             (NEW — ghcr image, same-origin build)
  kds             (NEW)
  admin           (NEW)
```

- **Online:** device loads from the cloud as today (unchanged, fast).
- **Offline:** device navigates to `http://<hub-LAN>/res/kds` (or `/res/pos`, `/res/admin`); nginx serves the app and proxies `/res/api` + `/res/socket.io` to the local `api`. Everything is on the LAN; zero internet.
- **Recovery:** internet returns → cloud reachable again; the hub's outbox drains to the cloud (existing OFF-4), no data lost.

## Key mechanic: same-origin API base (one image for cloud + hub)

The hub's LAN IP differs at every install, so the API URL **cannot be baked at build time**. Fix: every app talks to the API by a **relative, same-origin path** (`/res/api`, `/res/socket.io`), resolving against whatever host served the page.

- **KDS, POS:** already resolve the API base **per request** from a runtime endpoint store (`resolveApiBaseUrl()` / `resolveSocketBaseUrl()`). Keep that, and make the default **same-origin** when the app was served by the hub.
- **Admin:** currently bakes `NEXT_PUBLIC_API_BASE_URL` at build time with **no runtime override**. Change it to resolve the API + socket base at runtime, same-origin by default (mirror the KDS/POS pattern). This is the single biggest admin change.

With same-origin, the **same published image** runs on both cloud and hub — no hub-specific baking.

## Admin: edge-awareness + operational-only scoping

Backend is already most of the way there:

- The hub exposes **`GET /edge/info`** (public): `{ mode: "EDGE" | "CLOUD", organizationId, restaurantId, branchId, nodeId, ...liveness/sync }`.
- On the hub, **PlatformModule** (cross-tenant/org/platform-admin) and **AccountModule** (billing) are **excluded from the build** — those endpoints physically don't exist there.

So the admin work is mostly **frontend**:

1. On load, call `GET /edge/info`. If `mode === "EDGE"`:
   - **Lock** the active branch to `info.branchId`; hide branch / restaurant / org switchers.
   - **Hide** platform, account/billing, and any cross-branch sections (they'd 404 on the hub anyway).
   - **Operational-only allowlist** (proposed — refine): orders & tickets, KDS routing, menu **availability / 86'ing**, table & reservation ops, staff **PIN sign-in**, cash/shift ops, **read-only** reports.
   - **Disabled offline** (cloud-driven): user/role management, menu **structure** (items/categories/pricing), fiscal config, device enrollment for other branches, anything org/multi-branch.
   - Show a banner: *"Offline — managing **<branch>** via local hub."*
2. Add the runtime endpoint resolver to admin (so it can be served from, and talk to, the hub at all).

## Addressing the hub

- Reach the hub by a **stable LAN IP** (DHCP reservation on the router) or an **mDNS name** (`hub.local`).
- **Never a public domain** for the offline path — DNS resolution needs the internet.
- Update the Windows/Ubuntu hub guides: "Open POS/KDS/Admin at `http://<hub-ip>/res/pos` | `/res/kds` | `/res/admin`."

## Work breakdown (phased)

1. **Frontend — same-origin + admin runtime endpoint**
   - admin: runtime/relative API + socket base; `/edge/info` detection; operational-only gating; offline/branch banner.
   - kds/pos: default to same-origin when served by the hub; verify the endpoint resolver treats "served-from-hub" as the local target.
2. **Hub nginx config** — mirror the cloud `/res/*` routing: `/res/api/` → api, `/res/socket.io/` → api `/socket.io/`, `^~ /res/admin|pos|kds` → the app containers, on LAN :80 (and :443 if a local cert is added later).
3. **`docker-compose.edge.yml`** — add `nginx` + `pos` + `kds` + `admin` services (pull the public images), publish :80 on the LAN, `depends_on: api`.
4. **CI** — build & publish the hub frontend images (pos/kds/admin) built **same-origin**; either reuse the existing cloud images once they're same-origin, or add jobs. Mirror any new installer bits via the existing `mirror-hub` flow.
5. **Installer / guides** — LAN addressing guidance; the `/res/...` URLs above.
6. **Offline enrollment / login** — confirm a screen can enroll + a manager can sign in against the hub with **no cloud**: requires the branch's users + credentials to be present in the hub's synced DB (verify the snapshot/config sync includes them).

## Open questions / risks

- **Admin offline login:** admin uses email+password (not device PIN). For this to work offline, the manager's user + password hash must be in the hub's local DB — confirm the sync covers branch users' credentials.
- **Operational allowlist:** the exact in/out list above is a proposal; finalize which actions are "operational" vs "structural."
- **TLS / secure context:** LAN serving is `http://`. Fine for POS/KDS/Admin; note that any future PWA, camera/QR, or secure-context feature would need `https` (local cert).
- **Footprint:** three Next.js app containers + api + postgres + nginx on a mini-PC — check resource budget.
- **Socket.IO path:** same-origin `/res/socket.io` on the hub nginx must rewrite to the backend `/socket.io` (mirror the cloud rule in DEPLOY.md).

## Acceptance test

On a hub **with the internet physically cut**:
1. Open `http://<hub-ip>/res/kds`, `/res/pos`, `/res/admin` → all three load.
2. Staff sign in (PIN) on POS/KDS; a manager signs in on Admin → Admin shows the branch-scoped **operational-only** view with the offline banner.
3. Take an order on POS → it reaches KDS in real time (local socket).
4. Restore the internet → cloud reachable again, the hub's outbox drains, nothing is lost.
