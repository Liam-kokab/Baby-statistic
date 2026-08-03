# Process Management (PM2)

Production runs under [PM2](https://pm2.keymetrics.io/), a Node.js process manager. PM2 keeps the server, MCP server, and a health-check watchdog alive, automatically restarting any of them on crash. `ddns-keeper` and its watchdog are optional (see below) and only registered when explicitly enabled.

## Files
| File | Purpose |
|---|---|
| `ecosystem.config.js` | PM2 app definitions (root of repo) |
| `healthcheck.js` | Watchdog process — pings `/api/ping` on an interval and restarts the server via the PM2 API after repeated failures |
| `scripts/setup-autostart.sh` | One-time machine setup (`npm run setup:autostart`) so PM2 + everything it manages survives a reboot — see "Persisting Across Reboots" below |
| `deploy/systemd/weekly-reboot.service` / `.timer` | Scheduled weekly reboot (Monday 04:30) — see "Scheduled Weekly Reboot" below |

## Managed Processes
| Name | Script | Description |
|---|---|---|
| `baby-statistic-server` | `dist/index.js` | Express API + static client, internal port `3000` (nginx fronts public `80`/`443` in production — see `doc/nginx.md`) |
| `baby-statistic-mcp` | `dist/mcp-server/index.js` | MCP server (SSE), port `3001`. Talks to the API via `BABY_API_URL=http://localhost:3000` — must point at the server's internal port, **not** `80` (nginx's port-80 block only redirects to HTTPS, it doesn't proxy the API) |
| `baby-statistic-healthcheck` | `healthcheck.js` | Watchdog — see below |
| `ddns-keeper` *(optional)* | `ddns-keeper/dist/index.js` | Domeneshop DDNS updater + health/metrics HTTP server, port `3010` — see `doc/ddns-keeper.md`. Only registered when `DDNS_ENABLED=true` is set in the repo-root `.env` |
| `ddns-keeper-healthcheck` *(optional)* | `healthcheck.js` | Watchdog for `ddns-keeper`, polls `http://localhost:3010/health`. Only registered alongside `ddns-keeper` |

## Enabling/Disabling ddns-keeper
`ddns-keeper` is off by default — most deployments don't need DNS updating. `ecosystem.config.js` loads the repo-root `.env` (via `dotenv`) at config-evaluation time and only pushes the `ddns-keeper`/`ddns-keeper-healthcheck` app entries onto its `apps` array when `DDNS_ENABLED=true`:
```dotenv
# .env
DDNS_ENABLED=true
DOMENESHOP_TOKEN=...
DOMENESHOP_SECRET=...
DDNS_HOSTNAME=...
```
Since the decision is made when `ecosystem.config.js` is evaluated (not at runtime inside a process), toggling it requires re-running `pm2 start`/`startOrRestart ecosystem.config.js` (plain `pm2 restart` won't add/remove apps that already exist or don't exist in PM2's process list — use `pm2 delete ecosystem.config.js && pm2 start ecosystem.config.js` if you need to flip it on an existing PM2 setup, then `pm2 save`).


All apps have `autorestart: true`, `max_restarts: 10`, `min_uptime: '10s'`, and `exp_backoff_restart_delay` so a crash-looping process backs off instead of hammering restarts. This is PM2's built-in **crash restart** behaviour — no extra code needed for it.

Each app also declares an explicit `out_file` / `error_file` (under `logs/` at the repo root, gitignored) plus `merge_logs: true` and `time: true`. This guarantees each app's stdout/stderr goes to its own dedicated, timestamped file — `pm2 logs <name>` reads from these directly, so if one app's log looks empty it's genuinely producing no output (see Troubleshooting below), not a log-routing artifact.

## Health Check & Auto-Restart
`healthcheck.js` runs as its own PM2 process. Every `HEALTHCHECK_INTERVAL_MS` (default `30000`) it sends a `GET` to `HEALTHCHECK_URL` (default `http://localhost:3000/api/ping` — the server's internal port, **not** the public `80`/`443` nginx owns, since nginx's port-80 block only redirects to HTTPS rather than proxying the API — the existing `server/src/routes/ping.ts` endpoint). If the request fails or doesn't return `2xx` for `HEALTHCHECK_MAX_FAILURES` consecutive checks (default `3`), it calls the PM2 API (`pm2.restart('baby-statistic-server')`) to force a restart — this catches cases where the process is alive but unresponsive (e.g. deadlocked), which a crash-only restart wouldn't catch.

To avoid false positives around startup/restart timing, checks are skipped entirely during a **grace period** (`HEALTHCHECK_GRACE_MS`, default `20000`) right after the healthcheck process itself starts, and again immediately after it triggers a restart — this gives the target process (migrations, admin seed, etc.) time to actually finish booting before being judged unhealthy.

`healthcheck.js` is fully driven by environment variables, so it's reused as-is for a second watchdog process (`ddns-keeper-healthcheck`) that polls `ddns-keeper`'s `GET /health` endpoint instead of the main server's `/api/ping` — no code changes needed, just a second `ecosystem.config.js` entry with different env values.

| Env var | Default | Description |
|---|---|---|
| `HEALTHCHECK_URL` | `http://localhost:3000/api/ping` | Endpoint polled for health |
| `HEALTHCHECK_TARGET` | `baby-statistic-server` | PM2 app name to restart when unhealthy |
| `HEALTHCHECK_INTERVAL_MS` | `30000` | Poll interval |
| `HEALTHCHECK_MAX_FAILURES` | `3` | Consecutive failures before restarting |
| `HEALTHCHECK_TIMEOUT_MS` | `15000` | Per-request timeout before counting as a failure |
| `HEALTHCHECK_GRACE_MS` | `300000` | Checks are skipped for this long after process start and after each triggered restart |

The production defaults in `ecosystem.config.js` are tuned for weaker production hardware, where migrations + admin seed + first `listen()` can take much longer than on a dev machine — hence the 5 min grace period (up from a 20s default) and 15s per-request timeout, so the healthcheck doesn't restart a server that simply hasn't finished booting yet.

## Starting / Restarting Everything
```bash
npm run build      # compile client + server + mcp-server + ddns-keeper → dist/ (and ddns-keeper/dist/)
npm start          # build + pm2 start ecosystem.config.js (all 5 apps)
npm run restart    # pm2 restart ecosystem.config.js --update-env
npm run stop       # pm2 stop ecosystem.config.js
```

Other useful scripts:
| Command | Description |
|---|---|
| `npm run pm2:start` | `pm2 start ecosystem.config.js` (no rebuild) |
| `npm run pm2:restart` | Restart all managed apps, picking up new env vars |
| `npm run pm2:stop` | Stop all managed apps (keeps them registered in PM2) |
| `npm run pm2:delete` | Remove all managed apps from PM2 |
| `npm run pm2:status` | `pm2 status` — list process states |
| `npm run pm2:logs` | `pm2 logs` — tail logs for all managed apps |
| `npm run setup:autostart` | One-time: register PM2 (and nginx/certbot if present) to start on boot — see "Persisting Across Reboots" below |

## Persisting Across Reboots
For the app to actually come back up after a power cycle/reboot (e.g. a Raspberry Pi that loses power), PM2 itself must be registered as a boot-time systemd service — `autorestart` only recovers a **crashed** process, it does nothing if the whole machine restarts.

**Automated (recommended)** — run once after the first successful `npm start`, on the Pi itself, as the same (non-root) user PM2 runs as:
```bash
npm run setup:autostart
```
`scripts/setup-autostart.sh` runs `pm2 startup` and executes the `sudo` command it prints automatically (instead of requiring manual copy/paste), then `pm2 save` to freeze the current process list, and — if present on the machine — enables `nginx` and confirms `certbot.timer` are also set to start on boot. It also installs the weekly scheduled reboot (see "Scheduled Weekly Reboot" below). Re-run it any time `ecosystem.config.js`'s app list changes (e.g. toggling `DDNS_ENABLED`), since `pm2 save` needs to re-capture the new list.

**Manual equivalent**, if you'd rather run each step yourself:
```bash
pm2 startup   # prints a `sudo env PATH=... pm2 startup systemd ...` command — run exactly what it prints
pm2 save      # after `npm start`, freeze the current process list
sudo systemctl enable nginx      # if nginx fronts the app — see doc/nginx.md
```

Verify everything survives a real reboot:
```bash
sudo reboot
# after it comes back up:
pm2 status
systemctl status nginx   # if applicable
```

## Scheduled Daily Reboot
The production machine is a Raspberry Pi **without ECC RAM**, so bit flips / memory corruption can accumulate silently over long uptimes (unlike PM2's crash restart, which only helps once a process actually crashes). To mitigate this, a systemd timer reboots the whole machine **every day at 04:30** local time — chosen as the quietest window (overnight, everyone asleep, low traffic).

- `deploy/systemd/daily-reboot.service` — oneshot unit that runs `/sbin/reboot`.
- `deploy/systemd/daily-reboot.timer` — `OnCalendar=*-*-* 04:30:00`, `Persistent=true` (if the Pi was powered off at 04:30, it reboots as soon as it's next back up instead of silently skipping that day's reboot).

Installed automatically by `npm run setup:autostart` (step 5), which also removes any older `weekly-reboot.timer` unit left over from a previous setup. To opt out, set `SKIP_DAILY_REBOOT=true` before running it:
```bash
SKIP_DAILY_REBOOT=true npm run setup:autostart
```

Since PM2's `pm2 startup` service and `pm2 save`d process list (see above) bring every app back up automatically on boot, the daily reboot is safe — no manual intervention needed afterward.

To install/manage it manually instead:
```bash
sudo cp deploy/systemd/daily-reboot.service /etc/systemd/system/
sudo cp deploy/systemd/daily-reboot.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now daily-reboot.timer

# Inspect / verify:
systemctl list-timers daily-reboot.timer --no-pager   # shows next scheduled run
sudo systemctl status daily-reboot.timer

# Disable:
sudo systemctl disable --now daily-reboot.timer
```

### Migrating from the old weekly-reboot unit
If your machine already has `weekly-reboot.timer` installed from a previous setup, either re-run `npm run setup:autostart` (which now handles the swap automatically) or do it manually:
```bash
sudo systemctl disable --now weekly-reboot.timer
sudo rm -f /etc/systemd/system/weekly-reboot.service /etc/systemd/system/weekly-reboot.timer
sudo cp deploy/systemd/daily-reboot.service /etc/systemd/system/
sudo cp deploy/systemd/daily-reboot.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now daily-reboot.timer
```

## Deploying Updates (`deploy.sh`)
`deploy.sh` (repo root) automates a full production update on the server machine:

```bash
./deploy.sh          # deploys the current branch
./deploy.sh main     # or deploy a specific branch
# equivalently:
npm run deploy
```

Steps performed:
1. `pm2 stop ecosystem.config.js` — stop the server, MCP server, and healthcheck
2. `git fetch` + `git reset --hard origin/<branch>` + `git clean -fd` — discard local changes and sync to the remote branch exactly (respects `.gitignore`, so `data/`, `.env`, `node_modules`, etc. are left untouched)
3. **Conditional dependency install**: `package-lock.json` is hashed before and after the git pull. If it's unchanged (the common case — most deploys only touch application code) and `node_modules` already exists, `npm install` is **skipped entirely** — this is normally the slowest step of a deploy even when nothing actually needs installing. If the lockfile changed (or `node_modules` is missing, e.g. first deploy on a machine), `npm ci --prefer-offline --no-audit --no-fund` runs instead of `npm install` — faster and more reproducible since it installs exactly what's pinned in the lockfile and skips the audit/funding network round-trips.
4. `npm run build` — rebuild `client`, `server`, and `mcp-server` into `dist/`
5. `pm2 startOrRestart ecosystem.config.js --update-env` + `pm2 save` — bring everything back up (works whether or not the apps were already registered with PM2) and persist the process list for reboot survival

If you ever need to force a full reinstall regardless of the lockfile hash (e.g. corrupted `node_modules`), just delete `node_modules` before running `./deploy.sh`, or run `npm ci` manually.

### Other things to check before/after deploying
- **Database migrations** run automatically on server startup (`import './db'` in `server/src/index.ts`) — no manual migration step needed.
- **`.env` file**: not touched by `git clean`/`reset` since it's gitignored — must already exist at the repo root on the machine with `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and any `SEED_ADMIN_*` vars set (copy `.env.example` as a starting point). Loaded automatically via `server/src/loadEnv.ts` — see `doc/auth.md` / `doc/server.md`.
- **nginx / TLS**: one-time machine setup only, not part of this script — see `doc/nginx.md`.
- **Backups**: consider hitting `GET /api/backup` (admin only) before a risky deploy — see `doc/rest-api.md`.
- **`doc/openAPI.json`**: served at `/api-docs` directly from disk at server startup, so it's picked up automatically after `git reset` + restart — no extra step needed.

## Troubleshooting

### Production TLS / public port setup
Production no longer binds the Node app directly to port `80`/`443`. **nginx** owns those ports and reverse-proxies to the app's internal port `3000`, with TLS handled by Let's Encrypt/certbot. See **`doc/nginx.md`** for the full one-time setup. This sidesteps the `EACCES` problem below entirely — it's now documented mainly for historical context / alternative deployments that don't use nginx.

### `curl: (7) Failed to connect ... port 80 after 0 ms`
An immediate connection refusal (not a timeout) means **nothing is listening on port 80**. If you're using the nginx setup (`doc/nginx.md`), check nginx itself first:
```bash
sudo systemctl status nginx
sudo nginx -t
```
If you are instead running the Node app directly on port 80 (no nginx), check what's happening:
```bash
pm2 status
pm2 logs baby-statistic-server --lines 50 --nostream
```

**Most common cause**: on Linux/macOS, binding to any port below 1024 (like `80`) requires elevated privileges. If PM2 runs as a normal (non-root) user, `app.listen(80)` throws `EACCES: permission denied`, the app crashes on every start, and `autorestart` + `max_restarts: 10` exhausts its retries and gives up — leaving port 80 with nothing bound to it. Look for `Error: listen EACCES: permission denied 0.0.0.0:80` in the logs above.

Fixes (pick one):
1. **Run nginx in front on 80/443, app on a high port** (the approach used here — see `doc/nginx.md`): `ecosystem.config.js` sets `PORT: 3000` for `baby-statistic-server`; nginx reverse-proxies public traffic to it. No elevated privileges needed for PM2/Node at all.
2. **Grant Node the capability to bind low ports** (alternative — keeps PM2 running as a normal user, no nginx):
   ```bash
   sudo setcap 'cap_net_bind_service=+ep' $(readlink -f $(which node))
   pm2 restart ecosystem.config.js --update-env
   ```
   Must be re-run after upgrading the Node binary.
3. **Run PM2 as root** — works but not recommended for production.

### Healthcheck keeps restarting a server that seems fine
This usually means the healthcheck is failing (and restarting the target) faster than the target can actually finish booting, causing a restart loop even though the app is healthy once it's had time to start. Check `pm2 logs baby-statistic-healthcheck --lines 100 --nostream` for the actual failure reason before each restart (e.g. `ECONNREFUSED`, `The operation was aborted` = timeout, or `unhealthy status 5xx`/`4xx`).

- **Boots slower than the grace period allows**: if the server takes longer than `HEALTHCHECK_GRACE_MS` (default 20s) to start listening (e.g. slow disk, many migrations on first run), raise it: set `HEALTHCHECK_GRACE_MS` higher in `ecosystem.config.js` for the `baby-statistic-healthcheck` app.
- **Slow to respond under load, not actually down**: if the log shows timeouts (`The operation was aborted`) rather than connection refusals, raise `HEALTHCHECK_TIMEOUT_MS` (default 8000).
- **`HEALTHCHECK_URL` / `PORT` mismatch**: if you moved the server off port 80 (see above), make sure `HEALTHCHECK_URL` in `ecosystem.config.js` points at the same port the server actually listens on.
- After changing any of these, apply with `pm2 restart ecosystem.config.js --update-env` (plain `pm2 restart` does **not** pick up new `env` values from the config file).

### `pm2 logs baby-statistic-server` shows nothing at all (not even startup lines)
This means the process is dying before its first `console.log` ever flushes, or PM2 is reading stale log files from a previous registration. Check, in order:
1. **Is the app actually running?** `pm2 status` — if restarts (`↺`) is pegged at `max_restarts` (10) and status is `errored`/`stopped`, PM2 gave up; it won't retry or log anything further until you manually restart it.
2. **Read the log files directly** (bypasses `pm2 logs`' tailing/buffering): `pm2 describe baby-statistic-server` to confirm the exact `out_file` / `error_file` paths, then `cat logs/server-error.log` and `cat logs/server-out.log` at the repo root.
3. **Confirm the build actually happened on this machine**: `ls -la dist/index.js`. If it's missing (build failed or was never run), Node exits instantly with `Cannot find module`.
4. **Stale PM2 registration**: if `ecosystem.config.js` changed (e.g. added `out_file`) but PM2 still has an old process definition saved (`pm2 save`), delete and recreate it: `pm2 delete ecosystem.config.js && pm2 start ecosystem.config.js && pm2 save`.
5. Most common root cause is still the `EACCES` port-80 case above — check that first.

