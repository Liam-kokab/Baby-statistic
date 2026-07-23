// Periodically pings the server's health endpoint (/api/ping) and, after
// several consecutive failures, asks PM2 to restart the target process.
// Runs as its own PM2-managed process — see ecosystem.config.js.

const pm2 = require('pm2');

const URL = process.env.HEALTHCHECK_URL || 'http://localhost:80/api/ping';
const TARGET = process.env.HEALTHCHECK_TARGET || 'baby-statistic-server';
const INTERVAL_MS = Number(process.env.HEALTHCHECK_INTERVAL_MS) || 30000;
const MAX_FAILURES = Number(process.env.HEALTHCHECK_MAX_FAILURES) || 3;
const TIMEOUT_MS = 5000;

let consecutiveFailures = 0;

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

const checkHealth = async () => {
  try {
    const response = await fetch(URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) throw new Error(`unhealthy status ${response.status}`);
    consecutiveFailures = 0;
  } catch (err) {
    consecutiveFailures += 1;
    console.error(
      `[healthcheck] ping failed (${consecutiveFailures}/${MAX_FAILURES}):`,
      err instanceof Error ? err.message : err
    );
    if (consecutiveFailures >= MAX_FAILURES) {
      console.error(`[healthcheck] ${MAX_FAILURES} consecutive failures — restarting ${TARGET}`);
      restartTarget();
      consecutiveFailures = 0;
    }
  }
};

console.log(`[healthcheck] watching ${URL} every ${INTERVAL_MS}ms (target: ${TARGET})`);
setInterval(checkHealth, INTERVAL_MS);
checkHealth();

