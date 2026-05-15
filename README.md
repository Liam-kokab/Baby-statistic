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
- 🔄 **Backup & restore** — full DB export/import via REST API
- 📖 **Swagger UI** — interactive API docs at `/api-docs`
- 🐳 **Docker ready** — single-container deployment with persistent volume

## Tech Stack

| Layer | Tech |
|-------|------|
| Client | React 19, Vite 8, TypeScript, CSS Modules |
| Server | Express 5, TypeScript, better-sqlite3 |
| Database | SQLite (file-based, zero config) |
| Shared | npm workspaces monorepo with a `common/` types package |
| Deploy | Docker (Node 22 Alpine) |

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

### Production (Docker)

```bash
# Build the image
docker build -t baby-statistic .

# Run (mounts ./data for persistent SQLite storage)
docker run -d -p 80:80 -v ./data:/app/data baby-statistic
```

The container exposes port **80** and persists the database in the `/app/data` volume.

## How to Use

1. Open the app in your phone's browser and install it as a PWA (Add to Home Screen).
2. Use the bottom navigation bar to switch between sections.
3. Tap the main action button on each page to log an event (e.g., tap 💩 to log poop).
4. For milk: first log pumping sessions, then stored milk appears with expiry dates. When baby drinks, log it and the app deducts from storage automatically.
5. Use the date filter on list pages to review historical data.
6. Manage medicines on the Medicine page — add medicines, then tap to log doses.

## API Documentation

Interactive Swagger UI is available at `http://<host>/api-docs` when the server is running.

A full endpoint reference is in [`doc/rest-api.md`](doc/rest-api.md).

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
├── doc/             # Documentation (API, DB schema, deploy guide)
├── scripts/         # Build & deploy helper scripts
├── Dockerfile       # Multi-stage production build
└── data/            # SQLite database (gitignored in prod)
```

## License

Do whatever you want with it. If it helps you survive the newborn phase, I'm happy. 🫡

