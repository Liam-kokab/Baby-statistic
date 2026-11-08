#!/usr/bin/env bash
#
# deploy.sh — build the latest code in a staging folder, then swap it in with
# minimal downtime and redeploy under PM2.
#
# Steps:
#   1. Fetch the latest code and export it into a temp staging folder
#      (the running app is NOT touched)
#   2. Install dependencies in staging (only if package-lock.json changed,
#      otherwise reuse the live node_modules) + build everything there
#   3. Stop the PM2 apps  <-- downtime starts
#   4. Sync staging into the live folder (data/, .env*, logs/ and .git are preserved,
#      so the SQLite DB is never replaced)
#   5. Start/restart PM2 apps  <-- downtime ends
#
# If anything fails during steps 1-2, the live app keeps running untouched.
#
# Usage: ./deploy.sh [branch]   (branch defaults to the current branch)

set -euo pipefail

# Always run from the repo root (directory this script lives in)
cd "$(dirname "${BASH_SOURCE[0]}")"
LIVE_DIR="$(pwd)"

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync is required for deploy (e.g. 'sudo apt install rsync')" >&2
  exit 1
fi

BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"
LOCK_FILE="package-lock.json"

STAGING_DIR="$(mktemp -d "${TMPDIR:-/tmp}/baby-statistic-staging.XXXXXX")"
trap 'rm -rf "$STAGING_DIR"' EXIT

echo "==> [1/5] Exporting origin/${BRANCH} into staging (${STAGING_DIR})"
git fetch --all --prune
git archive "origin/${BRANCH}" | tar -x -C "$STAGING_DIR"

# Untracked config needed at build time (if any)
for f in .env .env.*; do
  [ -f "$f" ] && cp -p "$f" "$STAGING_DIR/$f"
done

# Compare lockfiles to decide whether dependencies changed. Most deploys only
# touch application code, so we skip `npm ci` — by far the slowest step.
DEPS_CHANGED=1
if [ -f "$LOCK_FILE" ] && [ -d node_modules ] \
  && cmp -s "$LOCK_FILE" "$STAGING_DIR/$LOCK_FILE"; then
  DEPS_CHANGED=0
fi

cd "$STAGING_DIR"

if [ "$DEPS_CHANGED" -eq 1 ]; then
  echo "==> [2/5] package-lock.json changed (or node_modules missing) — installing dependencies in staging"
  # --prefer-offline/--no-audit/--no-fund: skip needless network round-trips.
  # `npm ci` installs exactly what's in the lockfile.
  npm ci --prefer-offline --no-audit --no-fund
else
  echo "==> [2/5] package-lock.json unchanged — reusing live node_modules"
  # Workspace links in node_modules are relative, so a copy resolves inside staging.
  for d in node_modules */node_modules; do
    if [ -d "$LIVE_DIR/$d" ]; then
      mkdir -p "$(dirname "$d")"
      cp -a "$LIVE_DIR/$d" "$d"
    fi
  done
  # The live node_modules may be incomplete (e.g. installed without
  # devDependencies). Verify the copy and fall back to a clean install.
  if ! npm ls --all >/dev/null 2>&1; then
    echo "    copied node_modules is incomplete — running npm ci instead"
    DEPS_CHANGED=1
    rm -rf node_modules */node_modules
    npm ci --prefer-offline --no-audit --no-fund --include=dev
  fi
fi

echo "==> Building client + server + mcp-server in staging"
npm run build

cd "$LIVE_DIR"

echo "==> [3/5] Stopping PM2 apps (downtime starts)"
npx pm2 stop ecosystem.config.js || true

echo "==> [4/5] Replacing live files with staged build (preserving data/, .env*, logs/, .git)"
RSYNC_EXCLUDES=(
  --exclude=/.git
  --exclude=/data
  --exclude=/logs
  --exclude='/.env'
  --exclude='/.env.*'
  --exclude=/.pm2
  --exclude='/server/data'
  --exclude='*.db'
  --exclude='*.db-shm'
  --exclude='*.db-wal'
)
# Keep the live node_modules when dependencies didn't change
if [ "$DEPS_CHANGED" -eq 0 ]; then
  RSYNC_EXCLUDES+=(--exclude=node_modules)
fi
rsync -a --delete "${RSYNC_EXCLUDES[@]}" "$STAGING_DIR"/ "$LIVE_DIR"/

# Keep the git checkout's HEAD in sync with what was deployed (mixed reset:
# the working tree already matches, so no files are touched).
git reset -q "origin/${BRANCH}" || true

echo "==> [5/5] Starting/restarting PM2 apps (downtime ends)"
npx pm2 startOrRestart ecosystem.config.js --update-env
npx pm2 save

echo "==> Done. Current PM2 status:"
npx pm2 status
