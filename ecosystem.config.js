// PM2 process manager configuration.
// Usage: npm run start / npm run restart / npm run stop (see package.json)
// Docs: doc/pm2.md

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
      },
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};

