# Server

## Stack
- **Runtime**: Node.js 22
- **Framework**: Express 5
- **Language**: TypeScript (compiled via `tsc`, dev via `ts-node` + `nodemon`)
- **Database**: `better-sqlite3` (SQLite)
- **Auth**: `jsonwebtoken` (JWT — access token 15 min, refresh token 7 days), `bcryptjs` (password hashing, 12 rounds)
- **Security middleware**: `helmet` (security headers; CSP disabled — see note below), `cors` (explicit allow-list via `ALLOWED_ORIGINS`), `express-rate-limit` (login/refresh throttling)
- **Port**: `3000` by default (overridable via `PORT` env var). In production, nginx owns public ports `80`/`443` (TLS via Let's Encrypt) and reverse-proxies to this internal port — see `doc/nginx.md`.

## Environment Variables
Loaded from a `.env` file (see `.env.example` at the repo root) via `server/src/loadEnv.ts`, which must be the **first** import in `index.ts` — it uses `dotenv` and checks a couple of candidate paths since `process.cwd()` differs between dev (`server/`) and prod (repo root, see `ecosystem.config.js`). `.env` is gitignored; only `.env.example` (with empty values) is committed.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP listen port (internal-only in prod — nginx sits in front, see `doc/nginx.md`) |
| `DB_PATH` | `./data/baby.db` | SQLite file path |
| `ALLOWED_ORIGINS` | *(unset)* | Comma-separated list of extra CORS origins allowed to call the API cross-origin. Unset means same-origin only (the SPA is served from this same server in prod). |
| `JWT_ACCESS_SECRET` | `dev-access-secret-...` | Secret for signing 15-min access tokens |
| `JWT_REFRESH_SECRET` | `dev-refresh-secret-...` | Secret for signing 7-day refresh tokens |
| `BCRYPT_ROUNDS` | `12` | bcrypt salt rounds for password hashing |
| `SEED_ADMIN_USERNAME` | — | Auto-create admin user on first startup if no admin exists |
| `SEED_ADMIN_PASSWORD` | — | Password for the auto-created admin user |

> ⚠️ `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` **must** be set to long random strings in production — if `NODE_ENV=production` and either is unset, the server **refuses to start** (throws at import time in `authService.ts`) rather than silently falling back to insecure hardcoded dev defaults. See `doc/auth.md`.

## Rate Limiting
`POST /api/auth/login` and `POST /api/auth/refresh` are throttled via `express-rate-limit` (`routes/auth.ts`), keyed by IP:
- `/login`: 10 requests / 15 minutes
- `/refresh`: 60 requests / 15 minutes

Both return `429` with `{ "error": "Too many ... attempts. Please try again later." }` once the limit is exceeded.


## File Structure
```
server/
  src/
    loadEnv.ts         # loads .env (dotenv) — must be the first import in index.ts
    index.ts          # app entry — mounts middleware, routes, static serving
    db.ts             # DB singleton + migration runner + admin seed
    types.ts          # TTimeFilter, TAuthUser, TBabyContext + Express Request augmentation
    routes/           # one file per resource
      auth.ts         # POST /api/auth/login|refresh|logout, GET /api/auth/me
      admin.ts        # /api/admin/* (admin-only)
      baby.ts         # /api/baby (user-only)
      manifest.ts     # GET /manifest.json — theme-aware PWA manifest (public, mounted outside /api)
      simpleEventRouterFactory.ts  # builds standard CRUD router for "simple event" resources (pee, poop)
      ...             # existing data routes
    repositories/
      userRepository.ts   # users + refresh_tokens
      babyRepository.ts   # babies
      simpleEventRepositoryFactory.ts  # builds CRUD repository for "simple event" tables (pee, poop, pumping)
      ...             # existing data repositories (all now scoped by baby_id)
    services/
      authService.ts  # bcrypt + JWT sign/verify
      simpleEventServiceFactory.ts  # builds a TBabyContext-scoped service wrapping a simple-event repository
      ...             # existing services (all now accept TBabyContext)
    middleware/
      authenticate.ts   # verify Bearer access token → set req.user
      requireAdmin.ts   # guard: role must be 'admin' (or 'user' + babyId)
    ws/
      eventBus.ts       # process-local EventEmitter pub/sub: publishBabyUpdate(babyId) / subscribeBabyUpdates(babyId, listener)
      wsServer.ts       # attaches a `ws` WebSocketServer to the HTTP server on path `/ws`; authenticates via a `{ type: 'auth', token }` first message (not a query param), scopes each connection to one babyId
    migrations/
      index.ts        # migrations 001–018
    utils/
      bodyAs.ts       # casts req.body to Partial<T>
      time.ts         # Oslo timezone helpers
```

## Simple Event Factories
`pee`, `poop`, and `pumping` are structurally identical "timestamp-only" event tables (just `created_at` + the standard `baby_id`/`created_by` scoping columns). Rather than duplicating CRUD SQL/logic three times:
- `repositories/simpleEventRepositoryFactory.ts` — `createSimpleEventRepository<TDb, T>(tableName)` returns `findAll`/`findLatest`/`findById`/`insert`/`update`/`delete`/`getBackup`, generic over the DB row and app-facing types.
- `services/simpleEventServiceFactory.ts` — `createSimpleEventService<T>(repository)` wraps a simple-event repository with `TBabyContext` scoping.
- `routes/simpleEventRouterFactory.ts` — `createSimpleEventRouter<T>(service)` builds the standard `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` router.

`peeRepository`/`peeService`/routes/pee.ts and the `poop` equivalents are thin one-liners built entirely from these factories. `pumpingRepository`/`pumpingService` build on the same factories but add bespoke `findSummary` and a custom route (`routes/pumping.ts`) for its extra `/summary`, `/latest`, and `wished`-expansion endpoints — so it isn't routed through `createSimpleEventRouter`. `routes/nappy.ts` (combined pee+poop view) also reuses `peeRepository`/`poopRepository` directly instead of hand-rolled SQL `UNION ALL` queries.

## Entry Point (`src/index.ts`)
- Imports `'./loadEnv'` **first** — loads `.env` before any other module reads `process.env`
- Imports `'./db'` on startup — this triggers migrations automatically
- Registers `express.json()` middleware globally (default `100kb` body limit), **except** for `POST /api/backup/restore`, which is skipped globally and parses its own body in `routes/backup.ts` with a raised `20mb` limit (full-database restore payloads can exceed the default limit)
- Mounts Swagger UI at `/api-docs` (reads `doc/openAPI.json` at startup). The `servers` entry is rebuilt per-request from `req.protocol`/`req.get('host')` (via `app.set('trust proxy', 1)` + nginx's `X-Forwarded-Proto`/`Host` headers) instead of using the static `localhost:3000` URL from the JSON file, so "Try it out" works against whatever origin the docs were actually loaded from (dev or prod)
- Mounts all API routers under `/api/<name>`
- `authenticate` middleware is mounted on the `/api` prefix only (`app.use('/api', authenticate)`) — it never gates static assets or the SPA shell, since the browser can't send a Bearer token on page navigation and the login page itself must load before any token exists
- A second `/api` middleware (mounted right after `authenticate`) broadcasts a "this baby's data changed" WebSocket notification (via `ws/eventBus.ts`'s `publishBabyUpdate`) after any mutating request (`POST`/`PUT`/`PATCH`/`DELETE`) that completes with a 2xx status and has a `req.user.babyId` — see "Live Updates (WebSocket)" below
- In `NODE_ENV=production`: serves `server/public/` as static files and falls back to `index.html` for all non-API routes
- Creates a raw `http.Server` (`http.createServer(app)`) instead of calling `app.listen` directly, so `ws/wsServer.ts` can attach its own `upgrade` handler for the `/ws` path alongside the Express app

## Live Updates (WebSocket)
The server runs as a single PM2 fork process (see `ecosystem.config.js` — no cluster mode), so `ws/eventBus.ts` is a plain in-process `EventEmitter`; no Redis or other external broker is needed. If the server is ever scaled to multiple instances, `eventBus.ts` is the single place to swap in a real pub/sub backend.

- **`ws/eventBus.ts`** — `publishBabyUpdate(babyId, originClientId?)` / `subscribeBabyUpdates(babyId, listener)`, where `listener` receives the `originClientId` so callers can decide whether to skip notifying their own connection.
- **`ws/wsServer.ts`** — `attachWebSocketServer(httpServer)` upgrades connections on path `/ws`. Connections are accepted unauthenticated and must send `{ "type": "auth", "token": "<accessToken>", "clientId"?: "<uuid>" }` as their first message within 5s (`AUTH_TIMEOUT_MS`) — deliberately not a `?token=` query param, since query strings end up in nginx/proxy access logs and browser devtools/history. The token is verified with the same `verifyAccessToken` used by `authenticate`; on success the connection is scoped to that token's `babyId` and the server replies `{ "type": "auth-ok" }`. Connections that time out, send an invalid token, or lack a `babyId`, are closed. A 30s ping/pong heartbeat terminates dead connections.
- **Echo suppression** — the optional `clientId` in the auth message is a random per-tab ID the client generates once (`client/src/utils/wsClientId.ts`) and also sends as the `X-Ws-Client-Id` header on every mutating HTTP request (`authFetch.ts`). When a connection's own `clientId` matches the `originClientId` of an incoming update (i.e. this exact tab caused the change), `wsServer.ts` skips sending that notification to it — the tab already has fresh data from its own request's response, so re-notifying it would just be a redundant refetch. Every other connection (other tabs, other devices, even other devices logged in as the same username) is still notified normally, so multi-device setups stay in sync.
- **Connection dedup** — the same `clientId` is also used to keep at most one live connection per tab (`connectionsByClientId` map, keyed by `clientId`). If a tab's socket reconnects (e.g. coming back from being backgrounded, per `useBabyUpdatesSocket`'s Page Visibility handling) before its previous connection's close frame ever reached the server — common on mobile browsers, which can suspend a hidden tab's outgoing network activity before it gets a chance to send one — the new connection immediately `terminate()`s the stale one on successful auth, instead of waiting for the next heartbeat cycle (up to `HEARTBEAT_MS * 2` = 60s) to notice it's dead.
- Messages sent to clients carry **no data**, only `{ "type": "update" }` — the client is expected to re-run its own existing fetch/refetch logic on receipt (see `client/src/utils/useBabyUpdatesSocket.ts` and `doc/client.md`). This keeps the server-side change minimal and avoids duplicating each resource's serialization logic over the socket.
- The `index.ts` mutating-request middleware (see above) is the single hook point for all current and future routes — no per-route or per-service wiring is needed; it also forwards the `X-Ws-Client-Id` request header through to `publishBabyUpdate` as `originClientId`.

## Scripts

| Command | Description |
|---|---|
| `npm run build` | Local build: cleans `dist/`, builds client + server + mcp-server |
| `npm run dev` | Vite dev server (port 5173) + nodemon server (port 3000) concurrently |
| `npm run dev:client` | Vite dev server only |
| `npm run dev:server` | nodemon server only |
| `npm start` | Build then start server + MCP server + healthcheck under PM2 |
| `npm run restart` | Restart all PM2-managed apps |
| `npm run lint` (root) | Runs `eslint .` across every workspace |
| `npm test` (root) | Runs `server`, `client`, and `ddns-keeper` test suites (each via Vitest) |
| `npm run lint` / `npm test` (in `server/`) | `eslint src` / `vitest run` scoped to the server package |

See [`doc/pm2.md`](./pm2.md) for the full PM2 process-management setup (crash restart + health check).

## Build Output (`dist/`)
```
dist/
  index.js          ← compiled Express entry
  routes/ services/ repositories/ utils/ migrations/ db.js …
  public/           ← Vite-built React client (served at /)
    index.html
    manifest.json
    sw.js
    assets/
data/               ← database lives here (never wiped by build)
```

## Static File Serving
Express serves `dist/public/` as static files when `dist/public/index.html` exists (checked with `fs.existsSync`). No `NODE_ENV` check — it always serves the frontend if it has been built. This route is registered **outside** the `/api` prefix, so it is never gated by `authenticate` — the SPA shell, JS/CSS bundles, and `manifest.json` are always publicly servable. Auth is enforced client-side by `ProtectedRoute`, which redirects to `/login` if no token is stored.

`GET /manifest.json` is handled by `routes/manifest.ts` (mounted at `app.use('/manifest.json', manifestRouter)`, before the static middleware) rather than serving the static file directly — it reads `dist/public/manifest.json`, parses the `theme`/`themeMode` cookies set by the client, and overrides `theme_color` so PWA installs match the user's chosen theme.

## Security Headers & CSP
`helmet()` is applied globally (`server/src/index.ts`) for standard security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, HSTS, etc.). Its `contentSecurityPolicy` directive is explicitly **disabled** (`helmet({ contentSecurityPolicy: false })`) because a default `default-src 'self'` policy would break: the inline service-worker-registration `<script>` in `index.html`, the Google Fonts stylesheet/font CDN, and Swagger UI's inline scripts/styles at `/api-docs`. Revisit with a properly scoped CSP (nonces, explicit font/swagger allowances) if tightening further is needed.

## CORS
`cors()` is applied globally with `origin` resolved from `ALLOWED_ORIGINS` (comma-separated env var). If unset, `origin: false` is passed — no cross-origin requests are permitted (the SPA and API share an origin in production; Vite's dev proxy makes this a non-issue in dev too).



## Adding a Route
1. Create `server/src/routes/<name>.ts` — define handlers inline and wire them to `Router()`
2. Mount in `server/src/index.ts`: `app.use('/api/<name>', router)`
3. Handlers call services; services call repositories — never skip a layer

## Repositories
Each DB table has a repository in `server/src/repositories/`. Repositories:
- Accept and return only **app (camelCase) types** — never raw DB types
- Expose at minimum `findAll`, `findById`, `insert`, `update`, `delete`
- Contain two internal converters: `fromDb` (DB row → app type) and `toDb` (app type → DB row)

Extra methods beyond standard CRUD:

| Repository | Extra method | Description |
|---|---|---|
| `sleepRepository` | `findLatest()` | `SELECT … ORDER BY start DESC LIMIT 1` — returns latest or `null` |
| `servedMilkRepository` | `getTotal()` | Sums `amount` per `FRIDGE`/`FREEZER` status |
| `servedMilkRepository` | `expireOverdue()` | Flips overdue `FRIDGE`/`FREEZER` records to `EXPIRED` |
| `servedMilkRepository` | `deductStock(source, amount)` | Deducts `amount` from oldest matching records in a `db.transaction`; marks fully-consumed records as `USED` |
| `drankMilkRepository` | `deductWaste(waste)` | Reduces the latest drank record's amount (only `FRIDGE`/`FREEZER` source) by `waste` (floored at 0); skips `BOOB` records; does **not** touch `served_milk` |

## Services
Each table has a service in `server/src/services/`. Services sit between routes and repositories and are where business logic belongs.

| Service | Method | Extra behaviour |
|---|---|---|
| `servedMilkService` | `insert` | Calls `expireOverdue()` after inserting; auto-sets `expiryDate` (FRIDGE +4 d, FREEZER +6 mo) |
| `servedMilkService` | `update` | Calls `expireOverdue()` after updating |
 | `drankMilkService` | `insert` | For `FRIDGE`/`FREEZER`: logs the current prediction (into `prediction_log`), calls `deductStock` before inserting, and after the `drank_milk` row is created links the prediction to the actual drink. If `isNewBottle` is `false`, adds the amount to the latest existing record instead of creating a new one. `BOOB` skips stock deduction and is not logged/linked. |
| `drankMilkService` | `deductWaste(waste)` | Delegates to `drankMilkRepository.deductWaste`; only targets `FRIDGE`/`FREEZER` records; skips `deductStock` |
| `drankMilkService` | `findTodayStats(ctx)` | Delegates to `drankMilkRepository.findTodayAndRecentAvg` — today's ml so far (Oslo local date) vs the avg ml/day over the 10 days before today (divided by active days); backs `GET /api/drank-milk/today-stats` and is folded into `homeService.getAlwaysOnDisplay`. |
| `sleepService` | `findLatest()` | Delegates to `sleepRepository.findLatest()` |
| `homeService` | `getSummary(ctx)` | Aggregates `sleepService.findLatest`, `drankMilkService.findLatest`/`suggestNextDrinkAmount`, `pumpingService.findLatest`, latest pee/poop, and `medicineService.findAllActive` into one `THomeSummary` payload — backs `GET /api/home/summary`, used by the Home page for its first load and every subsequent update. |
| `homeService` | `getAlwaysOnDisplay(ctx)` | Lighter subset (`latestSleep`, `latestPumping`, `latestDrank`, `drankToday`, `medicines`) backing `GET /api/home/always-on-display` — used by every page's black-screen readout, refreshed on open and every 5 minutes after. |
| `appEventsService` | `reportBackupSuccess(timestamp?)` / `getBackupStatus()` | Upserts/reads the single `app_events` row with `id = 'BACKUP'`, backing `POST`/`GET /api/app-events/backup`. Not baby-scoped — a global, app-wide status. |

## Timezone
All timestamps are stored and returned as **Oslo local time** (`Europe/Oslo`). See `doc/db.md` for full details.

## Server settings
The server reads runtime settings from `server/src/config/config.json`. Prediction-related tuning values for the drank-milk service live under the `drankMilk.prediction` key (see also `drankMilk.bucket`, `drankMilk.recency`, and `drankMilk.logging`). Adjust those values and restart the server to change behaviour of endpoints such as `/api/drank-milk/suggested`.
## Auth & Authorisation
See [`doc/auth.md`](./auth.md) for the full authentication architecture, token flow, permission table, and security notes.

## MCP Server

See [`doc/mcp-server.md`](./mcp-server.md) for full documentation on the MCP server package (`mcp-server/`).
