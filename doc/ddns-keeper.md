# DdnsKeeper

A standalone Node.js/TypeScript service (separate from the main `baby-statistic` app) that keeps a Domeneshop DNS A record pointed at the current public IPv4 address. Lives in its own top-level folder, `ddns-keeper/`, with its own `package.json`, tests, and systemd units — independently deployable, but also registered as an npm workspace and PM2 app in this repo for convenience.

Full usage docs (install, config, systemd, troubleshooting) live in `ddns-keeper/README.md`. Certbot/Let's Encrypt setup lives in `ddns-keeper/CERTBOT.md`. This file covers the architecture from the main repo's perspective.

## Stack
- **Runtime**: Node.js 22, TypeScript
- **HTTP**: Express 5 (health/metrics server only — no client-facing UI)
- **Validation**: Zod (config schema)
- **Tests**: Vitest, all external HTTP mocked via `vi.stubGlobal('fetch', ...)`

## File Structure
```
ddns-keeper/
  src/
    config.ts                # loadConfig()/getConfig() — Zod-validated env vars
    logger.ts                # structured JSON logger → stdout + logs/ddns.log
    updateFlow.ts             # runUpdateFlow() + exported `metrics` object
    httpServer.ts             # createHttpServer()/startHttpServer() — /health, /metrics
    index.ts                  # entrypoint; continuous (default) or --once mode
    utils/retry.ts            # retryWithBackoff() + HttpStatusError
    services/
      ipService.ts             # fetchPublicIp(), isValidIPv4()
      stateService.ts           # getCurrentIp()/setCurrentIp() → data/current-ip.txt
      historyService.ts         # appendIpHistory() → data/ip-history.csv
      domeneshopClient.ts        # updateDomeneshopIp() — Domeneshop DDNS API client
  deploy/
    ddns-keeper.service        # systemd oneshot unit
    ddns-keeper.timer          # systemd timer, every 5 min
  README.md
  CERTBOT.md
```

## Update Flow
`runUpdateFlow(config)` in `updateFlow.ts`:
1. Read the last known IP from `data/current-ip.txt` (`getCurrentIp()`). Returns `null` if the file doesn't exist yet (fresh install, or state was deleted) — this is always treated as "no IP set", **never** as equal to the current IP, so the very first run on a new machine always pushes an update to Domeneshop instead of silently skipping it.
2. Fetch the current public IP from `IP_PROVIDER_URL` (`fetchPublicIp()`), retried up to 3× with exponential backoff (skips retry on 4xx).
3. If a previous IP exists **and** it matches the current one → log and return, no further action. On first run (no previous IP), this check is skipped entirely.
4. If changed (or first run) → call Domeneshop's DDNS update endpoint (`updateDomeneshopIp()`), same retry policy. Domeneshop's `dyndns/update` endpoint creates the A record if it doesn't exist yet, so this also covers the very first DNS record creation for a hostname that was never configured before.
5. **Only if the Domeneshop update succeeds**: append a row to `data/ip-history.csv` and persist the new IP via `setCurrentIp()`. A failed Domeneshop update never touches history/state, so the next run retries against the same "previous IP" baseline (or, on first run, retries as a first run again).

In-memory `metrics` (exported from `updateFlow.ts`) tracks `currentIp`, `lastUpdateAt`, `successfulUpdates`, `failedUpdates`, and `startedAt`, backing the `/metrics` HTTP endpoint.

## Domeneshop DDNS API
Uses Domeneshop's public API (see `doc/DNS-provider-doc.json` for the full OpenAPI spec) — specifically:
```
GET https://api.domeneshop.no/v0/dyndns/update?hostname=<host>&myip=<ip>
Authorization: Basic base64(token:secret)
```
`myip` is always passed explicitly (never omitted) so the update never relies on Domeneshop's automatic client-IP detection — this matters because the server calling the API may not be the same machine whose public IP needs updating in some deployments, and it keeps behavior deterministic/testable.

## Retry Policy
`utils/retry.ts` — `retryWithBackoff(fn, { maxAttempts, baseDelayMs, operationName })`:
- Retries any thrown error up to `maxAttempts` (default 3) times, delay = `baseDelayMs * 2^(attempt-1)`.
- **Does not** retry `HttpStatusError` instances with a `4xx` status — these are treated as permanent (bad credentials, bad hostname, etc.) and rethrown immediately.
- Used by both `ipService.fetchPublicIp()` and `domeneshopClient.updateDomeneshopIp()`.

## Logging
`logger.ts` writes one JSON line per event to both stdout and `logs/ddns.log` (fire-and-forget — a log-file write failure never crashes the app). Covers: startup, previous/current IP, unchanged-IP checks, update attempts/successes/failures, retry attempts, and unexpected exceptions (caught at the top level in `index.ts`).

## HTTP Endpoints
| Endpoint | Returns |
|---|---|
| `GET /health` | `{ status, currentIp, lastSuccessfulUpdateAt, hostname }` |
| `GET /metrics` | `{ currentIp, lastSuccessfulUpdateAt, uptimeSeconds, successfulUpdates, failedUpdates }` |

Binds to `localhost` only (`HTTP_PORT`, default `3000`; `3010` in this repo's `ecosystem.config.js` to avoid colliding with `baby-statistic-server`).

## Configuration / `.env`
`src/config.ts` resolves `.env` from (first match wins, none override already-set `process.env` vars): `ddns-keeper/.env` → repo-root `.env`. In this monorepo, `DOMENESHOP_TOKEN`/`DOMENESHOP_SECRET`/`DDNS_HOSTNAME`/etc. live in the **single combined root `.env`** alongside the server's `JWT_*`/`SEED_ADMIN_*` vars (see root `.env.example`) — no separate `ddns-keeper/.env` needed for PM2/dev. Standalone deployments (systemd on another host) use their own local `.env` instead, since they don't have the rest of the repo checked out.

**The service is optional and off by default.** In this repo's PM2 setup, `ecosystem.config.js` only registers the `ddns-keeper`/`ddns-keeper-healthcheck` apps when `DDNS_ENABLED=true` is set in the repo-root `.env` — see `doc/pm2.md`. Standalone systemd deployments aren't affected by this toggle (they run independently of PM2).

## Run Modes
- **Continuous** (default, used by PM2): starts the HTTP server, runs an immediate update check, then repeats every `POLL_INTERVAL_MS` (default 5 min).
- **One-shot** (`--once` flag or `DDNS_RUN_MODE=once`, used by the systemd timer): runs a single update check and exits — no HTTP server started.

## Integration With This Repo
- **npm workspace**: added to root `package.json` `workspaces`; `npm run build` builds it alongside `client`/`server`/`mcp-server`. Standalone scripts: `npm run dev:ddns`, `npm run build:ddns`.
- **PM2** (`ecosystem.config.js`): two extra apps, gated behind `DDNS_ENABLED=true` — `ddns-keeper` (the service itself, port 3010) and `ddns-keeper-healthcheck` (reuses the existing generic `healthcheck.js`, pointed at `http://localhost:3010/health`). See `doc/pm2.md`.
- **Independent deployment**: `ddns-keeper/` also ships its own systemd unit/timer for deployments that don't use this repo's PM2 setup at all.

## Testing
All external HTTP calls (`fetch` to the IP provider and to Domeneshop) are mocked with `vi.stubGlobal('fetch', ...)`; filesystem calls in `stateService`/`historyService` tests are mocked with `vi.mock('fs')`. Coverage: IP validation (`isValidIPv4`), config loading/validation (`loadConfig`), state storage, CSV history logging, the Domeneshop client (including 4xx-no-retry and 5xx-retry behavior), and the full update flow (unchanged IP / successful update / failed Domeneshop update never saving state / first run with no previous IP unconditionally sets DNS).

Run with:
```bash
npm test -w ddns-keeper
```

