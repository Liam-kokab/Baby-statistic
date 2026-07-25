# DdnsKeeper

A small standalone service that keeps a Domeneshop DNS A record pointed at your current public IPv4 address. Polls a public IP provider, compares it against the last known IP, and updates Domeneshop's DDNS endpoint only when it changes.

See `doc/ddns-keeper.md` (in the main repo's `doc/` folder) for architecture notes, and `CERTBOT.md` for issuing/renewing Let's Encrypt certificates against the same hostname using the Domeneshop DNS-01 plugin.

## Directory Structure
```
ddns-keeper/
  src/
    config.ts              # Env var loading + validation (Zod)
    logger.ts               # Structured logger → stdout + logs/ddns.log
    updateFlow.ts            # Main update flow + in-memory metrics
    httpServer.ts            # /health and /metrics endpoints
    index.ts                 # Entrypoint (continuous or --once mode)
    utils/retry.ts           # Exponential backoff retry helper
    services/
      ipService.ts            # Fetches + validates the public IP
      stateService.ts          # data/current-ip.txt read/write
      historyService.ts        # data/ip-history.csv append-only log
      domeneshopClient.ts      # Domeneshop DDNS API client
  deploy/
    ddns-keeper.service       # systemd unit (oneshot)
    ddns-keeper.timer         # systemd timer (every 5 min)
  data/                       # current-ip.txt, ip-history.csv (gitignored)
  logs/                       # ddns.log (gitignored)
```

## Installation
```bash
cd ddns-keeper
npm install
```
Configuration is read from a single combined `.env` at the **repo root** (shared with the main `server` app — see the root `.env.example`), so no separate install step is needed if you're already running this monorepo. Just make sure the repo-root `.env` has the `DOMENESHOP_*`/`DDNS_*` variables below set.

Running `ddns-keeper` fully standalone, outside this monorepo (e.g. copied to another machine)? Create a local `.env` inside `ddns-keeper/` instead — it takes priority over the repo-root one when present (see `src/config.ts`).

## Configuration
All configuration is via environment variables, loaded (in order of priority) from: `ddns-keeper/.env` (if present) → **the repo-root `.env`** (recommended — shared with `server`, see root `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `DOMENESHOP_TOKEN` | *(required)* | Domeneshop API token (Basic Auth username) — generate at https://www.domeneshop.no/admin?view=api |
| `DOMENESHOP_SECRET` | *(required)* | Domeneshop API secret (Basic Auth password) |
| `DDNS_HOSTNAME` | *(required)* | Fully qualified hostname to keep updated (must already have an A record in Domeneshop) |
| `IP_PROVIDER_URL` | `https://checkip.amazonaws.com` | Service used to look up the current public IPv4 address |
| `POLL_INTERVAL_MS` | `300000` (5 min) | How often to check for IP changes in continuous mode |
| `HTTP_PORT` | `3000` | Port for the `/health` and `/metrics` HTTP server. **Note:** this repo's `ecosystem.config.js` overrides it to `3010` in production to avoid clashing with `baby-statistic-server` on `3000` — leave unset in `.env` unless running standalone (no PM2) |
| `RETRY_MAX_ATTEMPTS` | `3` | Max attempts (with exponential backoff) for network requests |
| `RETRY_BASE_DELAY_MS` | `500` | Base delay for exponential backoff (delay = base × 2^attempt) |

## Manual Execution
```bash
npm run dev          # continuous mode, auto-reload, logs to stdout + logs/ddns.log
npm run build        # compile TypeScript → dist/
npm start            # continuous mode (production build)
npm run run:once     # single update check then exit (no HTTP server) — used by systemd
```

In continuous mode, an HTTP server exposes:
- `GET /health` → `{ status, currentIp, lastSuccessfulUpdateAt, hostname }`
- `GET /metrics` → `{ currentIp, lastSuccessfulUpdateAt, uptimeSeconds, successfulUpdates, failedUpdates }`

## Running with systemd
Use this instead of PM2 if you want the OS to trigger a fresh one-shot run every 5 minutes rather than running a long-lived process. Since a standalone systemd deployment typically lives outside this monorepo (e.g. copied to `/opt/ddns-keeper`), it uses its own local `.env` rather than the repo-root one:

```bash
npm run build                                   # produces dist/index.js
sudo mkdir -p /opt/ddns-keeper
sudo cp -r dist package.json /opt/ddns-keeper/
sudo cp ../.env /opt/ddns-keeper/.env            # combined root .env, or a ddns-keeper-only subset
sudo chmod 600 /opt/ddns-keeper/.env
sudo cp deploy/ddns-keeper.service deploy/ddns-keeper.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ddns-keeper.timer
```

Check status/logs:
```bash
systemctl status ddns-keeper.timer
systemctl list-timers ddns-keeper.timer
journalctl -u ddns-keeper.service -f
```

## Troubleshooting
- **"Invalid ddns-keeper configuration" on startup** — a required env var (`DOMENESHOP_TOKEN`, `DOMENESHOP_SECRET`, `DDNS_HOSTNAME`) is missing or `IP_PROVIDER_URL` isn't a valid URL. The error message names the offending field(s).
- **IP never updates** — check `logs/ddns.log` for `"IP unchanged — no update needed"` (expected, not a bug) vs an actual error. Also confirm `data/current-ip.txt` isn't stale/incorrect — delete it to force a re-check on next run.
- **Domeneshop update fails with 401** — check `DOMENESHOP_TOKEN` / `DOMENESHOP_SECRET`; the new IP is deliberately **not** saved when this happens, so the next run retries the same update.
- **Domeneshop update fails with 4xx (not 401)** — these are not retried (only 5xx/network errors are); check the hostname exists in your Domeneshop account and has an A record already.
- **HTTP server not reachable** — it binds to `localhost` only by design; use `curl http://localhost:<HTTP_PORT>/health` on the host itself, or a reverse proxy if external access is needed.
- **systemd timer not firing** — `systemctl list-timers` shows next scheduled run; `journalctl -u ddns-keeper.service` shows the last run's output (stdout/stderr go to journald per the unit's `StandardOutput=journal`).

