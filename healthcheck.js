// Periodically pings the server's health endpoint (/api/ping) and, after
// several consecutive failures, asks PM2 to restart the target process.
// Runs as its own PM2-managed process — see ecosystem.config.js.

const pm2 = require('pm2');

const URL = process.env.HEALTHCHECK_URL || 'http://localhost:80/api/ping';
const TARGET = process.env.HEALTHCHECK_TARGET || 'baby-statistic-server';
const INTERVAL_MS = Number(process.env.HEALTHCHECK_INTERVAL_MS) || 30000;
const MAX_FAILURES = Number(process.env.HEALTHCHECK_MAX_FAILURES) || 3;
const TIMEOUT_MS = Number(process.env.HEALTHCHECK_TIMEOUT_MS) || 8000;
// Skip checks for this long after (a) the healthcheck process itself starts,
// and (b) every time it triggers a restart of the target — the target needs
// time to boot (migrations, admin seed, etc.) and shouldn't be judged
// unhealthy just because it isn't listening yet.
const GRACE_MS = Number(process.env.HEALTHCHECK_GRACE_MS) || 20000;

let consecutiveFailures = 0;
let pausedUntil = Date.now() + GRACE_MS;

const restartTarget = () => {
  pm2.connect((connectErr) => {
    if (connectErr) {
      console.error('[healthcheck] pm2 connect failed:', connectErr.message);
      return;
    }
    pm2.restart(TARGET, (restartErr) => {
      if (restartErr) {
        console.error(`[healthcheck] restart of ${TARGET} failed:`, restartErr.message);
      } else {
        console.log(`[healthcheck] ${TARGET} restarted successfully`);
      }
      pm2.disconnect();
    });
  });
};

const onCheckFailed = (reason) => {
  consecutiveFailures += 1;
  console.error(`[healthcheck] ping failed (${consecutiveFailures}/${MAX_FAILURES}):`, reason);
  if (consecutiveFailures >= MAX_FAILURES) {
    console.error(`[healthcheck] ${MAX_FAILURES} consecutive failures — restarting ${TARGET}`);
    restartTarget();
    consecutiveFailures = 0;
    pausedUntil = Date.now() + GRACE_MS; // give the restarted process time to boot
  }
};

const checkHealth = async () => {
  if (Date.now() < pausedUntil) return; // still in a startup/post-restart grace period

  let response;
  try {
    response = await fetch(URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    onCheckFailed(err instanceof Error ? err.message : err);
    return;
  }

  if (!response.ok) {
    onCheckFailed(`unhealthy status ${response.status}`);
    return;
  }

  consecutiveFailures = 0;
};

console.log(
  `[healthcheck] watching ${URL} every ${INTERVAL_MS}ms (target: ${TARGET}, ` +
    `timeout: ${TIMEOUT_MS}ms, grace: ${GRACE_MS}ms, max failures: ${MAX_FAILURES})`
);
setInterval(checkHealth, INTERVAL_MS);

