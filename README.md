# 🍼 Baby Statistic

> **Disclaimer:** This is a vibe-coded project I made while running on very little sleep (because, you know… baby). It's scrappy, it works for me, and it might work for you too. Anyone is welcome to fork it, improve it, or just laugh at it.

---

## What Is This?

A simple self-hosted baby statistics tracker that logs daily events for your newborn:

- 🍼 **Milk consumed** — manage consumed milk fridge with expiry tracking, log feeds from fridge/boob, and handle waste
- 🌙 **Sleep** — record sleep start/end times
- 🥛 **Pumping** — log pumping sessions so you know when to pump next. (Not oil, please don't invade)
- 💩 **Poop** — one-tap poop logging
- 💧 **Pee** — one-tap pee logging (nappy summary combines pee + poop)
- 💊 **Medicine** — track medicines and log doses
- 🍼 **Milk storage** — currently disabled, but the code is mostly there!

## Features

- 📱 **PWA** — installable on your phone's home screen for quick access (requires HTTPS)
- 🏠 **Home dashboard** — at-a-glance view of today's events, easy access to logging actions
- 📅 **Date range filtering** — view logs for any time period
- 🧊 **Smart milk management** — automatic expiry calculation (fridge: 4 days, freezer: 6 months), automatic deduction from storage when baby drinks, FIFO ordering
- 🔮 **Next-bottle prediction** — the server suggests a rounded `nextDrinkAmount` for the next bottle based on recent drinking patterns (configurable lookback). Predictions are logged so you can compare predicted vs actual consumption and improve the model over time.
- 🔐 **Multi-user & multi-baby with JWT auth** — admins create users/babies; each user is scoped to one baby, with short-lived access tokens and rotating refresh tokens (no self-registration)
- 🤖 **MCP server** — exposes the whole API as tools for AI agents (SSE transport), so you can log feeds or ask "how much milk today?" straight from an AI chat client
- 🔄 **Backup & restore** — full DB export/import via REST API; optional standalone AWS Lambda (`backup-lambda/`) can automate scheduled backups to S3
- 📖 **Swagger UI** — interactive API docs at `/api-docs`
- 🌐 **Self-hosted DNS updater (`ddns-keeper`)** — optional standalone service that keeps a Domeneshop DNS A record pointed at your current public IP, handy if you're hosting this at home

## Tech Stack

| Layer       | Tech                                                             |
|-------------|-------------------------------------------------------------------|
| Client      | React 19, Vite, TypeScript, CSS Modules                          |
| Server      | Express 5, TypeScript, better-sqlite3, JWT auth                  |
| MCP server  | Model Context Protocol server (SSE transport)                    |
| DDNS keeper | Standalone Domeneshop DNS updater service                        |
| Database    | SQLite (file-based, zero config)                                 |
| Shared      | npm workspaces monorepo with a `common/` types package            |
| Process     | PM2 (crash restart + health-check watchdogs for all processes)   |

## Getting Started

### Prerequisites

- Node.js 22+
- npm 10+

### Install

```bash
git clone https://github.com/Liam-kokab/Baby-statistic.git
cd baby-statistic
npm install
```

### Development

```bash
npm run dev          # starts client (5173) + server (3000) + mcp-server (3001) concurrently
npm run dev:client   # Vite dev server only
npm run dev:server   # Express server only (nodemon + ts-node)
npm run dev:mcp      # MCP server only
npm run dev:ddns     # DDNS keeper only (3010, optional/standalone)
```

The Vite dev server proxies all `/api/*` requests to `http://localhost:3000`.

### Production (PM2)

```bash
npm start           # builds, then starts server + MCP server + healthcheck under PM2
npm run restart      # restart everything (picks up new env vars)
npm run stop         # stop everything
npm run pm2:status   # check process status
npm run pm2:logs     # tail logs
```

See [`doc/pm2.md`](doc/pm2.md) for the full process-management setup, including the health-check watchdogs that restart processes if they stop responding.

On the production machine, `./deploy.sh` (or `npm run deploy`) pulls the latest code, rebuilds, and restarts everything under PM2 in one step.

## How to Use

1. An admin logs in and creates a baby plus a user account for that baby (no self-registration — see [`doc/auth.md`](doc/auth.md)).
2. Open the app in your phone's browser and install it as a PWA (Add to Home Screen).
3. Use the bottom navigation bar to switch between sections.
4. Tap the main action button on each page to log an event (e.g., tap 💩 to log poop).
5. For milk: first log pumping sessions, then stored milk appears with expiry dates. When baby drinks, log it and the app deducts from storage automatically.
6. Use the date filter on list pages to review historical data.
7. Manage medicines on the Medicine page — add medicines, then tap to log doses.
8. Prefer chatting with an AI? Point an MCP-compatible client at the `mcp-server` and log/query data via natural language — see [`doc/mcp-server.md`](doc/mcp-server.md).

## Documentation

| File                                     | Description                                    |
|-------------------------------------------|------------------------------------------------|
| [`doc/rest-api.md`](doc/rest-api.md)       | Full REST endpoint reference                   |
| [`doc/server.md`](doc/server.md)           | Express setup, file structure, scripts         |
| [`doc/client.md`](doc/client.md)           | React app structure, components, Vite config   |
| [`doc/db.md`](doc/db.md)                   | SQLite schema, migrations, triggers            |
| [`doc/common.md`](doc/common.md)           | Shared types package, exports, usage           |
| [`doc/auth.md`](doc/auth.md)               | JWT auth, roles, multi-baby data isolation     |
| [`doc/mcp-server.md`](doc/mcp-server.md)   | MCP server: tools, SSE transport, env vars     |
| [`doc/ddns-keeper.md`](doc/ddns-keeper.md) | DDNS keeper service: polling, retry, health    |
| [`doc/pm2.md`](doc/pm2.md)                 | PM2 process management, health check, restart  |
| [`doc/userGuid.md`](doc/userGuid.md)       | End-user guide                                 |

Interactive Swagger UI is available at `http://<host>/api-docs` when the server is running.

## ⚠️ Disclaimers

- **Bring your own security.** JWT auth with admin/user roles is built in, but there's no rate limiting, email verification, or password-reset flow. If you expose it to the internet, do so behind HTTPS and **at your own risk**.
- **Multi-baby, but still small-scale.** Multiple babies and users are supported now (each user scoped to one baby), but this is still built for a household, not a hospital.
- **No medical advice.** This is a logging tool, not a medical device. Don't make health decisions based solely on this app.
- **Vibe coded.** The code quality varies. Some parts are clean, some parts are "it's 3 AM and the baby is crying."
- **SQLite.** Great for a handful of users, not designed for heavy concurrent writes at scale. Works perfectly fine for a family (or two) of sleep-deprived parents.

## Project Structure

```
baby-statistic/
├── common/          # Shared TypeScript types & utilities
├── client/          # React + Vite frontend
├── server/          # Express + SQLite backend
├── mcp-server/       # Model Context Protocol server (AI agent tools)
├── ddns-keeper/      # Standalone Domeneshop DNS updater
├── doc/             # Documentation (API, DB schema, auth, etc.)
├── ecosystem.config.js  # PM2 process definitions
├── healthcheck.js       # PM2-managed health-check watchdog
├── deploy.sh            # Pull + build + PM2 restart in one step
└── data/            # SQLite database (gitignored in prod)
```

## License

Do whatever you want with it. If it helps you survive the newborn phase, I'm happy. 🫡

