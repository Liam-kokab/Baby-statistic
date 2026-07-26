#!/usr/bin/env bash
#
# setup-autostart.sh — one-time machine setup so everything comes back up
# automatically after a reboot (designed for a Raspberry Pi running Debian,
# but works on any systemd-based Linux distro).
#
# What it does:
#   1. Generates + installs the PM2 boot-time systemd service
#      (`pm2 startup`), so PM2 itself starts on boot.
#   2. Freezes the current PM2 process list (`pm2 save`), so PM2 knows which
#      apps to resurrect (baby-statistic-server, baby-statistic-mcp,
#      baby-statistic-healthcheck, and ddns-keeper/-healthcheck if enabled).
#   3. Enables nginx to start on boot, if installed (see doc/nginx.md).
#   4. Confirms certbot's renewal timer is enabled, if certbot is installed
#      (see doc/nginx.md) — it self-registers on install, this just verifies.
#   5. Installs + enables a weekly scheduled reboot (Monday 04:30) — a Pi
#      with no ECC RAM benefits from a periodic clean restart. Set
#      SKIP_WEEKLY_REBOOT=true to opt out. See doc/pm2.md "Scheduled Weekly
#      Reboot" for details.
#
# Run this once after the app is already up under PM2 (`npm start`), and
# again any time you change which apps PM2 manages (`ecosystem.config.js`),
# since step 2 needs `pm2 save` re-run to pick up the new process list.
#
# Usage: ./scripts/setup-autostart.sh   (run as the same user PM2 runs as —
#                                        NOT as root; sudo is invoked
#                                        internally only where needed)

set -euo pipefail

# Always run from the repo root (this script lives in scripts/)
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ "$(id -u)" -eq 0 ]; then
  echo "Do not run this script as root/sudo directly — run it as the user PM2" >&2
  echo "runs as; it will invoke sudo itself for the steps that need it." >&2
  exit 1
fi

# This script needs sudo for several steps below. Authenticate once up front
# with a clearly-labelled prompt, instead of silently blocking on a password
# prompt later that gets swallowed inside a `$(...)` command substitution
# (looks like the script has hung when it's really just waiting on stdin).
echo "==> This script needs sudo for several steps — you may be prompted for your password now."
sudo -v

echo "==> [1/5] Generating the PM2 boot-time systemd service"
# `pm2 startup` prints (rather than runs) a `sudo env PATH=$PATH pm2 startup
# systemd -u <user> --hp <home>` command. We tee its output to the terminal
# (via /dev/stderr) so it's visible in real time, while also capturing it to
# extract and run that command automatically instead of requiring a manual
# copy/paste.
PM2_STARTUP_OUTPUT="$( (npx --yes pm2 startup systemd -u "$(whoami)" --hp "$HOME" | tee /dev/stderr) || true)"
STARTUP_CMD="$(echo "$PM2_STARTUP_OUTPUT" | grep '^sudo ' | tail -1 || true)"
if [ -n "$STARTUP_CMD" ]; then
  echo "    Running: $STARTUP_CMD"
  eval "$STARTUP_CMD"
else
  echo "Could not auto-detect the pm2 startup command from the output above." >&2
  echo "Copy the 'sudo env PATH=...' line it printed and run it manually, then re-run this script." >&2
  exit 1
fi

echo "==> [2/5] Freezing the current PM2 process list for reboot"
npx --yes pm2 save

echo "==> [3/5] Enabling nginx to start on boot (skipped if not installed)"
if systemctl list-unit-files 2>/dev/null | grep -q '^nginx\.service'; then
  sudo systemctl enable nginx
else
  echo "    nginx not installed — skipping (see doc/nginx.md if you front the app with nginx)."
fi

echo "==> [4/5] Checking certbot's auto-renewal timer (skipped if not installed)"
if systemctl list-unit-files 2>/dev/null | grep -q '^certbot\.timer'; then
  sudo systemctl enable --now certbot.timer
  systemctl is-enabled certbot.timer
else
  echo "    certbot.timer not found — skipping (only relevant if you use Let's Encrypt via certbot, see doc/nginx.md)."
fi

echo "==> [5/5] Installing the weekly scheduled reboot (Monday 04:30)"
if [ "${SKIP_WEEKLY_REBOOT:-false}" = "true" ]; then
  echo "    SKIP_WEEKLY_REBOOT=true — skipping."
else
  sudo cp deploy/systemd/weekly-reboot.service /etc/systemd/system/weekly-reboot.service
  sudo cp deploy/systemd/weekly-reboot.timer /etc/systemd/system/weekly-reboot.timer
  sudo systemctl daemon-reload
  sudo systemctl enable --now weekly-reboot.timer
  systemctl list-timers weekly-reboot.timer --no-pager
fi

echo ""
echo "==> Done. Verify with a real reboot:"
echo "    sudo reboot"
echo "    # after it comes back up:"
echo "    pm2 status"

