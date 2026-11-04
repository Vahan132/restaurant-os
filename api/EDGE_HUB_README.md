# Restaurant OS — Edge Hub (operator guide)

A restaurant hub is one small on-prem box (a mini-PC) that runs your branch
locally, keeps working when the internet drops, and syncs with the cloud when
it's back. This guide is the **Docker-generic** setup — it works the same on any
machine that can run Docker (Windows, Linux, or macOS). Installing Docker itself
and making the hub start on power-on are covered by the per-OS setup sheets.

## What you need

- A machine running **Docker** (Docker Desktop on Windows/macOS, Docker Engine on
  Linux) with `docker compose`.
- The two files for this release: `docker-compose.edge.yml` and `.env.edge.example`.
- The pairing code from your cloud dashboard for this branch.

No login to any image registry is required — the hub image is **public**. Nothing
secret is stored in the image; the hub's identity and keys are delivered later,
when you pair it.

## 1. Configure

Copy the example environment file and open it:

```bash
cp .env.edge.example .env.edge
```

You only need to set a few things:

- **`EDGE_IMAGE_TAG`** — the release to run, e.g. `edge-v0.1.0` (pin this so you
  get a known-good version). Leave unset to track the newest build.
- **The auth secrets** (`JWT_*`, `CONSUMER_JWT_*`) — set each to its own random
  string of at least 16 characters. Generate them however you like, e.g.
  `openssl rand -hex 24`.

Leave the identity fields (`EDGE_ORG_ID`, `EDGE_NODE_TOKEN`, and so on) **blank** —
pairing fills those in for you.

## 2. Start the hub

```bash
docker compose -f docker-compose.edge.yml --env-file .env.edge up -d
```

This pulls the public image and starts two containers: the API and its own local
Postgres database. (The hub does **not** need Redis — it runs realtime in-process
for a single node.) The API applies its database migrations automatically on
start.

## 3. Pair it

Open the hub's setup page from any device on the same network:

```
http://<hub-ip>:3001/setup
```

Enter the pairing code from your cloud dashboard. The hub saves its identity to a
durable volume, pulls its branch data, and switches from **setup mode** to serving
your branch. That identity survives restarts and updates — you only pair once.

## 4. Keep it updated

Updates are deliberate and safe to run during service — the hub keeps serving
locally throughout and catches up its sync afterward.

```bash
docker compose -f docker-compose.edge.yml --env-file .env.edge pull
docker compose -f docker-compose.edge.yml --env-file .env.edge up -d
```

(Or run `scripts/edge-update.sh`.) To move to a specific release, set
`EDGE_IMAGE_TAG=edge-vX.Y.Z` in `.env.edge` first. The new image applies any new
database migrations on start, then restarts the API — your data and pairing are
preserved on their named volumes.

## Stopping / starting

```bash
docker compose -f docker-compose.edge.yml --env-file .env.edge stop   # pause
docker compose -f docker-compose.edge.yml --env-file .env.edge up -d   # resume
docker compose -f docker-compose.edge.yml --env-file .env.edge down    # remove containers (data volumes kept)
```

Your data lives in Docker named volumes (`edge_pgdata`, `edge_data`), so `down`
and `up` do not lose anything. Only `down -v` would erase them — don't run that on
a live hub.

## Good to know

- **Secret-free & public image.** The image contains no credentials and runs as a
  non-root user. The moat is the cloud + your data, not the code.
- **Postgres only, no Redis.** A hub is a single node; realtime runs in-process.
- **Works offline.** Once paired, the hub runs without the internet and pushes its
  changes to the cloud when the connection returns.
- **Media** (menu images, etc.) is served locally and stored on the `edge_data`
  volume, so it survives updates.

## Troubleshooting

- **`/setup` won't load** — check the containers are up:
  `docker compose -f docker-compose.edge.yml --env-file .env.edge ps`, and see the
  logs: `... logs -f api`.
- **API keeps restarting** — almost always a missing/short secret in `.env.edge`
  (each `JWT_*` / `CONSUMER_JWT_*` must be at least 16 characters). The logs name
  the offending variable.
- **Can't reach the hub from another device** — confirm you're using the hub's LAN
  IP and port `3001`, and that the host firewall allows it.
