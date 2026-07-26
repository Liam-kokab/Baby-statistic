// PM2 process manager configuration.
// Usage: npm run start / npm run restart / npm run stop (see package.json)
// Docs: doc/pm2.md

const path = require('path');
const dotenv = require('dotenv');

// ddns-keeper is optional (Domeneshop DDNS updater) — off by default. Set
// DDNS_ENABLED=true in the repo-root .env to have PM2 manage it. Loaded here
// (rather than relying on server/src/loadEnv.ts) because this config file
// itself decides which PM2 apps to register, before any app process starts.
dotenv.config({ path: path.join(__dirname, '.env') });

const LOG_DIR = path.join(__dirname, 'logs');
const DDNS_ENABLED = process.env.DDNS_ENABLED === 'true';

const apps = [
  {
    name: 'baby-statistic-server',
      script: 'dist/index.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      // Explicit log paths + timestamps so `pm2 logs` / the raw files are
      // never ambiguous about which app produced (or failed to produce) output.
      out_file: path.join(LOG_DIR, 'server-out.log'),
      error_file: path.join(LOG_DIR, 'server-error.log'),
      merge_logs: true,
      time: true,
    },
    {
      name: 'baby-statistic-mcp',
      script: 'dist/mcp-server/index.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        MCP_MODE: 'sse',
        MCP_PORT: 3001,
        // Internal port the Express app actually listens on (see the
        // baby-statistic-server app above) — nginx fronts public 80/443 and
        // proxies to this port, but internal service-to-service calls should
        // go straight to it. Do NOT point this at 80: nginx's port-80 server
        // block only 301-redirects to HTTPS (see doc/nginx.md), it does not
        // proxy the API directly.
        BABY_API_URL: 'http://localhost:3000',
      },
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      out_file: path.join(LOG_DIR, 'mcp-out.log'),
      error_file: path.join(LOG_DIR, 'mcp-error.log'),
      merge_logs: true,
      time: true,
    },
    {
      name: 'baby-statistic-healthcheck',
      script: 'healthcheck.js',
      cwd: __dirname,
      env: {
        HEALTHCHECK_URL: 'http://localhost:3000/api/ping',
        HEALTHCHECK_TARGET: 'baby-statistic-server',
        HEALTHCHECK_INTERVAL_MS: 30000,
        HEALTHCHECK_MAX_FAILURES: 3,
        HEALTHCHECK_TIMEOUT_MS: 15000,
        // Production runs on much weaker hardware than dev — migrations + admin
        // seed + first listen can take well over the old 20s default. Give it
        // 5 min of grace after (re)start before judging it unhealthy.
        HEALTHCHECK_GRACE_MS: 300000,
      },
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      out_file: path.join(LOG_DIR, 'healthcheck-out.log'),
      error_file: path.join(LOG_DIR, 'healthcheck-error.log'),
      merge_logs: true,
      time: true,
    },
];

// ddns-keeper (Domeneshop DNS updater) is optional and off by default — only
// registered as PM2 apps when DDNS_ENABLED=true is set in the repo-root .env.
if (DDNS_ENABLED) {
  apps.push(
    {
      name: 'ddns-keeper',
      script: 'dist/index.js',
      cwd: path.join(__dirname, 'ddns-keeper'),
      env: {
        NODE_ENV: 'production',
        HTTP_PORT: 3010,
      },
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      out_file: path.join(LOG_DIR, 'ddns-keeper-out.log'),
      error_file: path.join(LOG_DIR, 'ddns-keeper-error.log'),
      merge_logs: true,
      time: true,
    },
    {
      name: 'ddns-keeper-healthcheck',
      script: 'healthcheck.js',
      cwd: __dirname,
      env: {
        HEALTHCHECK_URL: 'http://localhost:3010/health',
        HEALTHCHECK_TARGET: 'ddns-keeper',
        HEALTHCHECK_INTERVAL_MS: 60000,
        HEALTHCHECK_MAX_FAILURES: 3,
        HEALTHCHECK_TIMEOUT_MS: 15000,
        HEALTHCHECK_GRACE_MS: 60000,
      },
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      out_file: path.join(LOG_DIR, 'ddns-keeper-healthcheck-out.log'),
      error_file: path.join(LOG_DIR, 'ddns-keeper-healthcheck-error.log'),
      merge_logs: true,
      time: true,
    },
  );
}

module.exports = { apps };
