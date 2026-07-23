# Process Management (PM2)

Production runs under [PM2](https://pm2.keymetrics.io/), a Node.js process manager. PM2 keeps the server, MCP server, and a health-check watchdog alive, automatically restarting any of them on crash.

## Files
| File | Purpose |
|---|---|
| `ecosystem.config.js` | PM2 app definitions (root of repo) |
| `healthcheck.js` | Watchdog process — pings `/api/ping` on an interval and restarts the server via the PM2 API after repeated failures |

## Managed Processes
| Name | Script | Description |
|---|---|---|
| `baby-statistic-server` | `dist/index.js` | Express API + static client, port `80` |
| `baby-statistic-mcp` | `dist/mcp-server/index.js` | MCP server (SSE), port `3001` |
| `baby-statistic-healthcheck` | `healthcheck.js` | Watchdog — see below |

All three apps have `autorestart: true`, `max_restarts: 10`, `min_uptime: '10s'`, and `exp_backoff_restart_delay` so a crash-looping process backs off instead of hammering restarts. This is PM2's built-in **crash restart** behaviour — no extra code needed for it.

## Health Check & Auto-Restart
`healthcheck.js` runs as its own PM2 process. Every `HEALTHCHECK_INTERVAL_MS` (default `30000`) it sends a `GET` to `HEALTHCHECK_URL` (default `http://localhost:80/api/ping`, the existing `server/src/routes/ping.ts` endpoint). If the request fails or doesn't return `2xx` for `HEALTHCHECK_MAX_FAILURES` consecutive checks (default `3`), it calls the PM2 API (`pm2.restart('baby-statistic-server')`) to force a restart — this catches cases where the process is alive but unresponsive (e.g. deadlocked), which a crash-only restart wouldn't catch.

| Env var | Default | Description |
|---|---|---|
| `HEALTHCHECK_URL` | `http://localhost:80/api/ping` | Endpoint polled for health |
| `HEALTHCHECK_TARGET` | `baby-statistic-server` | PM2 app name to restart when unhealthy |
| `HEALTHCHECK_INTERVAL_MS` | `30000` | Poll interval |
| `HEALTHCHECK_MAX_FAILURES` | `3` | Consecutive failures before restarting |

## Starting / Restarting Everything
```bash
npm run build      # compile client + server + mcp-server → dist/
npm start          # build + pm2 start ecosystem.config.js (all 3 apps)
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

## Persisting Across Reboots (optional)
To have PM2 automatically start these apps after a machine reboot:
```bash
pm2 startup   # follow the printed instructions once
pm2 save      # after `npm start`, freeze the current process list
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
3. `npm install` — pick up any new/updated dependencies across all workspaces
4. `npm run build` — rebuild `client`, `server`, and `mcp-server` into `dist/`
5. `pm2 startOrRestart ecosystem.config.js --update-env` + `pm2 save` — bring everything back up (works whether or not the apps were already registered with PM2) and persist the process list for reboot survival

### Other things to check before/after deploying
- **Database migrations** run automatically on server startup (`import './db'` in `server/src/index.ts`) — no manual migration step needed.
- **`.env` file**: not touched by `git clean`/`reset` since it's gitignored — make sure `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and any `SEED_ADMIN_*` vars are already set on the machine (see `doc/auth.md`).
- **Backups**: consider hitting `GET /api/backup` (admin only) before a risky deploy — see `doc/rest-api.md`.
- **`doc/openAPI.json`**: served at `/api-docs` directly from disk at server startup, so it's picked up automatically after `git reset` + restart — no extra step needed.

