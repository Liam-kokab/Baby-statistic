#!/usr/bin/env bash
#
# deploy.sh — pull the latest code and redeploy the app under PM2.
#
# Steps:
#   1. Stop the PM2-managed apps (server, MCP server, healthcheck)
#   2. Discard any local changes and pull the latest code from git
#   3. Install dependencies + build client/server/mcp-server
#   4. Start/restart everything under PM2 and persist the process list
#
# Usage: ./deploy.sh [branch]   (branch defaults to the current branch)

set -euo pipefail

# Always run from the repo root (directory this script lives in)
cd "$(dirname "${BASH_SOURCE[0]}")"

BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"

echo "==> [1/5] Stopping PM2 apps"
npx pm2 stop ecosystem.config.js || true

echo "==> [2/5] Discarding local changes"
git fetch --all --prune
git reset --hard "origin/${BRANCH}"
git clean -fd

echo "==> [3/5] Installing dependencies"
npm install

echo "==> [4/5] Building client + server + mcp-server"
npm run build

echo "==> [5/5] Starting/restarting PM2 apps"
npx pm2 startOrRestart ecosystem.config.js --update-env
npx pm2 save

echo "==> Done. Current PM2 status:"
npx pm2 status

