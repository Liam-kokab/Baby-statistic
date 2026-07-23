# 🍼 Baby Statistic

> **Disclaimer:** This is a vibe-coded project I made while running on very little sleep (because, you know… baby). It's scrappy, it works for me, and it might work for you too. Anyone is welcome to fork it, improve it, or just laugh at it.

---

## What Is This?

A simple self-hosted baby statistics tracker that logs daily events for your newborn:

- 🍼 **Milk consumed** — manage consumed milk fridge with expiry tracking, log feeds from fridge/boob, and handle waste
- 🌙 **Sleep** — record sleep start/end times
- 🥛 **Pumping** — log pumping sessions so you know when to pump next. (Not oil, please don't invade)
- 💩 **Poop** — one-tap poop logging
- 💧 **Pee** — one-tap pee logging
- 💊 **Medicine** — track medicines and log doses
- 🍼 **Milk storage** — currently disabled, but the code is mostly there!

## Features

- 📱 **PWA** — installable on your phone's home screen for quick access (requires HTTPS)
- 🏠 **Home dashboard** — at-a-glance view of today's events, easy access to logging actions
- 📅 **Date range filtering** — view logs for any time period
- 🧊 **Smart milk management** — automatic expiry calculation (fridge: 4 days, freezer: 6 months), automatic deduction from storage when baby drinks, FIFO ordering
 - 🔮 **Next-bottle prediction** — the server suggests a rounded `nextDrinkAmount` for the next bottle based on recent drinking patterns (configurable lookback). Predictions are logged so you can compare predicted vs actual consumption and improve the model over time.
- 🔄 **Backup & restore** — full DB export/import via REST API
- 📖 **Swagger UI** — interactive API docs at `/api-docs`

## Tech Stack

| Layer    | Tech                                                   |
|----------|--------------------------------------------------------|
| Client   | React 19, Vite 8, TypeScript, CSS Modules              |
| Server   | Express 5, TypeScript, better-sqlite3                  |
| Database | SQLite (file-based, zero config)                       |
| Shared   | npm workspaces monorepo with a `common/` types package |
| Process  | PM2 (crash restart + health-check watchdog)            |

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
npm run dev          # starts client (port 5173) + server (port 3000) concurrently
npm run dev:client   # Vite dev server only
npm run dev:server   # Express server only (nodemon + ts-node)
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

See [`doc/pm2.md`](doc/pm2.md) for the full process-management setup, including the health-check watchdog that restarts the server if it stops responding.

On the production machine, `./deploy.sh` (or `npm run deploy`) pulls the latest code, rebuilds, and restarts everything under PM2 in one step.

## How to Use

1. Open the app in your phone's browser and install it as a PWA (Add to Home Screen).
2. Use the bottom navigation bar to switch between sections.
3. Tap the main action button on each page to log an event (e.g., tap 💩 to log poop).
4. For milk: first log pumping sessions, then stored milk appears with expiry dates. When baby drinks, log it and the app deducts from storage automatically.
5. Use the date filter on list pages to review historical data.
6. Manage medicines on the Medicine page — add medicines, then tap to log doses.

## Documentation

| File                                 | Description                                    |
|--------------------------------------|------------------------------------------------|
| [`doc/rest-api.md`](doc/rest-api.md) | Full REST endpoint reference                   |
| [`doc/server.md`](doc/server.md)     | Express setup, file structure, scripts         |
| [`doc/client.md`](doc/client.md)     | React app structure, components, Vite config   |
| [`doc/db.md`](doc/db.md)             | SQLite schema, migrations, triggers            |
| [`doc/common.md`](doc/common.md)     | Shared types package, exports, usage           |
| [`doc/pm2.md`](doc/pm2.md)           | PM2 process management, health check, restart  |
| [`doc/userGuid.md`](doc/userGuid.md) | End-user guide                                 |

Interactive Swagger UI is available at `http://<host>/api-docs` when the server is running.

## ⚠️ Disclaimers

- **No authentication.** This app has zero user auth. I run it on my private home network behind a firewall. If you expose it to the internet, **you do so at your own risk**.
- **Single user.** There's no concept of multiple users or babies — it's one app, one baby. If you have twins, well… good luck.
- **No medical advice.** This is a logging tool, not a medical device. Don't make health decisions based solely on this app.
- **Vibe coded.** The code quality varies. Some parts are clean, some parts are "it's 3 AM and the baby is crying."
- **SQLite.** Great for single-user, not designed for concurrent multi-device writes at scale. Works perfectly fine for a family of sleep-deprived parents.

## Project Structure

```
baby-statistic/
├── common/          # Shared TypeScript types & utilities
├── client/          # React + Vite frontend
├── server/          # Express + SQLite backend
├── doc/             # Documentation (API, DB schema)
├── ecosystem.config.js  # PM2 process definitions
├── healthcheck.js       # PM2-managed health-check watchdog
├── deploy.sh            # Pull + build + PM2 restart in one step
└── data/            # SQLite database (gitignored in prod)
```

## License

Do whatever you want with it. If it helps you survive the newborn phase, I'm happy. 🫡

