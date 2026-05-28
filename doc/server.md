# Server

## Stack
- **Runtime**: Node.js 22
- **Framework**: Express 5
- **Language**: TypeScript (compiled via `tsc`, dev via `ts-node` + `nodemon`)
- **Database**: `better-sqlite3` (SQLite)
- **Port**: `80` (overridable via `PORT` env var)

## File Structure
```
server/
  src/
    index.ts          # app entry — mounts middleware, routes, static serving
    db.ts             # DB singleton + migration runner + now_oslo() UDF
    routes/           # one file per resource
    repositories/     # CRUD per table
    services/         # business logic per table
    migrations/
      index.ts        # ordered migrations array (env-conditional for seed/clear)
    utils/
      bodyAs.ts       # casts req.body to Partial<T>
      time.ts         # Oslo timezone helpers: nowOslo(), toOsloLocal(), toOsloIso()
data/
  baby.db             # SQLite database (auto-created; gitignored; outside dist/)
dist/                 # tsc output (gitignored) — server JS + dist/public/ (client)
index.js              # production entry point: require('./dist/index.js')
scripts/
  docker-run.js       # stops old container + starts new one
```

## Entry Point (`src/index.ts`)
- Imports `'./db'` on startup — this triggers migrations automatically
- Registers `express.json()` middleware
- Mounts Swagger UI at `/api-docs` (reads `doc/openAPI.json` at startup)
- Mounts all API routers under `/api/<name>`
- In `NODE_ENV=production`: serves `server/public/` as static files and falls back to `index.html` for all non-API routes

## Scripts
| Command | Description |
|---|---|
| `npm run build` | Docker build → stop old container → start new on port 80 |
| `npm start` | Re-run the already-built Docker image (no rebuild) |
| `npm run build:local` | Local build: cleans `dist/`, builds client + server |
| `npm run dev` | Vite dev server (port 5173) + nodemon server (port 3000) concurrently |
| `npm run dev:client` | Vite dev server only |
| `npm run dev:server` | nodemon server only |

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
Express serves `dist/public/` as static files when `dist/public/index.html` exists (checked with `fs.existsSync`). No `NODE_ENV` check — it always serves the frontend if it has been built.

## Docker
`npm run build` runs a two-stage Docker build:

| Stage | What it does |
|---|---|
| `builder` | Installs all deps, runs `npm run build -w client && npm run build -w server` |
| `production` | Installs prod deps only, copies `dist/` + `doc/` + `index.js`, exposes port 80 |

The database volume `baby-statistic-data` is mounted at `/app/data` — persists across container restarts and rebuilds.

```powershell
npm run build   # build image + restart container
npm start       # restart container without rebuild
```

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
| `sleepService` | `findLatest()` | Delegates to `sleepRepository.findLatest()` |

## Timezone
All timestamps are stored and returned as **Oslo local time** (`Europe/Oslo`). See `doc/db.md` for full details.

## Server settings
The server reads runtime settings from `server/src/config/config.json`. Prediction-related tuning values for the drank-milk service live under the `drankMilk.prediction` key (see also `drankMilk.bucket`, `drankMilk.recency`, and `drankMilk.logging`). Adjust those values and restart the server to change behaviour of endpoints such as `/api/drank-milk/suggested`.
## MCP Server

See [`doc/mcp-server.md`](./mcp-server.md) for full documentation on the MCP server package (`mcp-server/`).
