# Restaurant OS — path-based deployment behind one Tailscale host

All apps are served from a single origin, **https://msi.tail8514ca.ts.net**, routed
under **`/res/*`** (no subdomains). nginx terminates the host and proxies each path
prefix to a local port.

| App      | basePath     | Port | URL                                             |
| -------- | ------------ | ---- | ----------------------------------------------- |
| API      | — (`/res/api`) | 5200 | `https://msi.tail8514ca.ts.net/res/api`         |
| website  | `/res`       | 4000 | `https://msi.tail8514ca.ts.net/res`             |
| admin    | `/res/admin` | 4001 | `https://msi.tail8514ca.ts.net/res/admin`       |
| pos      | `/res/pos`   | 4002 | `https://msi.tail8514ca.ts.net/res/pos`         |
| kds      | `/res/kds`   | 4003 | `https://msi.tail8514ca.ts.net/res/kds`         |
| customer | `/res/m`     | 4004 | `https://msi.tail8514ca.ts.net/res/m/<slug>?qr=<qr>` |

Socket.IO is reached at `/res/socket.io` on the host; nginx maps it back to the
backend's default `/socket.io`. The backend itself keeps the default path.

---

## Environment

These are **build-time** values for the frontends (`NEXT_PUBLIC_*` are inlined at
`pnpm build`), so set them before building. They live in each app's `.env` /
`.env.local` (already populated for this host).

### api — `api/.env`
```dotenv
PORT=5200
CORS_ORIGINS="https://msi.tail8514ca.ts.net,http://localhost:3000,http://localhost:5173"
PLATFORM_ROOT_DOMAIN="msi.tail8514ca.ts.net"   # no subdomain -> falls back to X-Restaurant-Slug
# plus the usual DATABASE_URL / REDIS_URL / JWT secrets
```

### website — `website/.env.local`
```dotenv
NEXT_PUBLIC_API_BASE_URL=https://msi.tail8514ca.ts.net/res/api
NEXT_PUBLIC_ADMIN_URL=https://msi.tail8514ca.ts.net/res/admin
NEXT_PUBLIC_POS_URL=https://msi.tail8514ca.ts.net/res/pos
NEXT_PUBLIC_KDS_URL=https://msi.tail8514ca.ts.net/res/kds
NEXT_PUBLIC_CUSTOMER_URL_TEMPLATE=https://msi.tail8514ca.ts.net/res/m/{slug}?qr={qr}
```

### admin — `admin/.env`
```dotenv
NEXT_PUBLIC_API_BASE_URL=https://msi.tail8514ca.ts.net/res/api
NEXT_PUBLIC_SOCKET_BASE_URL=https://msi.tail8514ca.ts.net
NEXT_PUBLIC_SOCKET_PATH=/res/socket.io
NEXT_PUBLIC_CUSTOMER_URL_TEMPLATE=https://msi.tail8514ca.ts.net/res/m/{slug}?qr={qr}
```

### pos — `pos/.env.local`  ·  kds — `kds/.env.local`
```dotenv
NEXT_PUBLIC_API_BASE_URL=https://msi.tail8514ca.ts.net/res/api
NEXT_PUBLIC_SOCKET_BASE_URL=https://msi.tail8514ca.ts.net
NEXT_PUBLIC_SOCKET_PATH=/res/socket.io
```

### customer — `customer/.env.local`
```dotenv
NEXT_PUBLIC_API_BASE_URL=https://msi.tail8514ca.ts.net/res/api
# Leave NEXT_PUBLIC_RESTAURANT_SLUG UNSET — the slug is read from the path
# (/res/m/<slug>) via usePathname() and forwarded as the X-Restaurant-Slug header.
```

> The `basePath` per app is set in each `next.config.mjs` and also exposed to the
> client as `NEXT_PUBLIC_BASE_PATH` so hard `window.location` redirects (the
> 401 → `/login` bounce) keep the prefix.

---

## Build + run (one terminal per app)

```bash
# API (NestJS, port 5200)
cd api      && pnpm install && pnpm prisma:generate && pnpm build && pnpm start:prod

# website (port 4000)
cd website  && pnpm install && pnpm build && pnpm start    # -> next start -p 4000

# admin (port 4001)
cd admin    && pnpm install && pnpm build && pnpm start    # -> next start -p 4001

# pos (port 4002)
cd pos      && pnpm install && pnpm build && pnpm start    # -> next start -p 4002

# kds (port 4003)
cd kds      && pnpm install && pnpm build && pnpm start    # -> next start -p 4003

# customer (port 4004)
cd customer && pnpm install && pnpm build && pnpm start    # -> next start -p 4004
```

Each app's `dev`/`start` scripts already pin the right port. Rebuild a frontend
whenever you change its `NEXT_PUBLIC_*` env (they are baked in at build time).

---

## nginx

Add this to the server block that fronts the Tailscale host, then reload. The
specific `/res/<app>` prefixes win by longest-match; `/res` is the website
catch-all. `/res/api` strips its prefix; `/res/socket.io` rewrites to `/socket.io`.

```nginx
map $http_upgrade $connection_upgrade { default upgrade; '' close; }

server {
    listen 443 ssl;                 # or rely on `tailscale serve` for TLS
    server_name msi.tail8514ca.ts.net;

    # Inherited by every plain proxy_pass below.
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Realtime — socket.io (websocket upgrade). /res/socket.io/ -> /socket.io/
    location /res/socket.io/ {
        proxy_pass http://127.0.0.1:5200/socket.io/;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        $connection_upgrade;
        proxy_read_timeout 600s;
    }

    # API — strip the /res/api prefix (trailing slash on proxy_pass does this).
    location /res/api/ { proxy_pass http://127.0.0.1:5200/; }

    # Next apps — keep the full path (basePath included). Most specific first.
    location ^~ /res/admin { proxy_pass http://127.0.0.1:4001; }
    location ^~ /res/pos   { proxy_pass http://127.0.0.1:4002; }
    location ^~ /res/kds   { proxy_pass http://127.0.0.1:4003; }
    location ^~ /res/m     { proxy_pass http://127.0.0.1:4004; }
    location /res          { proxy_pass http://127.0.0.1:4000; }  # website
}
```

Reload:

```bash
sudo nginx -t && sudo nginx -s reload
```

---

## Smoke test (acceptance)

1. `https://msi.tail8514ca.ts.net/res` loads the website; signup completes and lands
   in the account hub.
2. The hub links open admin / pos / kds under `/res/...`; login works on each.
3. `https://msi.tail8514ca.ts.net/res/m/<slug>?qr=<qr>` loads that restaurant's menu
   for the scanned table.
4. Realtime flows through `/res/socket.io` (POS → KDS, `order_request.new`, …).
