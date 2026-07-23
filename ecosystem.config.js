// PM2 process manager configuration.
// Usage: npm run start / npm run restart / npm run stop (see package.json)
// Docs: doc/pm2.md

const path = require('path');

const LOG_DIR = path.join(__dirname, 'logs');

module.exports = {
  apps: [
    {
      name: 'baby-statistic-server',
      script: 'dist/index.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 80,
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
        BABY_API_URL: 'http://localhost:80',
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
        HEALTHCHECK_URL: 'http://localhost:80/api/ping',
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
  ],
};

