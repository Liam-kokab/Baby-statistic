#!/usr/bin/env bash
#
# deploy.sh — pull the latest code and redeploy the app under PM2.
#
# Steps:
#   1. Stop the PM2-managed apps (server, MCP server, healthcheck)
#   2. Discard any local changes and pull the latest code from git
#   3. Install dependencies (skipped if package-lock.json didn't change) + build client/server/mcp-server
#   4. Start/restart everything under PM2 and persist the process list
#
# Usage: ./deploy.sh [branch]   (branch defaults to the current branch)

set -euo pipefail

# Always run from the repo root (directory this script lives in)
cd "$(dirname "${BASH_SOURCE[0]}")"

BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"
LOCK_FILE="package-lock.json"

# Hash the lockfile *before* pulling new code, so we can tell after the pull
# whether dependencies actually changed. Most deploys only touch application
# code, so this lets us skip `npm install` entirely on those — it's by far
# the slowest step even when nothing actually needs installing.
OLD_LOCK_HASH=""
if [ -f "$LOCK_FILE" ]; then
  OLD_LOCK_HASH="$(sha256sum "$LOCK_FILE" | awk '{print $1}')"
fi

echo "==> [1/5] Stopping PM2 apps"
npx pm2 stop ecosystem.config.js || true

echo "==> [2/5] Discarding local changes"
git fetch --all --prune
git reset --hard "origin/${BRANCH}"
git clean -fd

NEW_LOCK_HASH=""
if [ -f "$LOCK_FILE" ]; then
  NEW_LOCK_HASH="$(sha256sum "$LOCK_FILE" | awk '{print $1}')"
fi

if [ "$OLD_LOCK_HASH" != "$NEW_LOCK_HASH" ] || [ ! -d node_modules ]; then
  echo "==> [3/5] package-lock.json changed (or node_modules missing) — installing dependencies"
  # --prefer-offline: use the local npm cache instead of hitting the registry
  # for metadata whenever possible. --no-audit/--no-fund: skip the extra
  # network round-trips for the security-advisory and funding checks, which
  # add real latency on every install but aren't useful in an automated
  # deploy. `npm ci` (rather than `npm install`) installs exactly what's in
  # the lockfile and is both faster and more reproducible for this case.
  npm ci --prefer-offline --no-audit --no-fund
else
  echo "==> [3/5] package-lock.json unchanged — skipping npm install"
fi

echo "==> [4/5] Building client + server + mcp-server"
npm run build

echo "==> [5/5] Starting/restarting PM2 apps"
npx pm2 startOrRestart ecosystem.config.js --update-env
npx pm2 save

echo "==> Done. Current PM2 status:"
npx pm2 status

