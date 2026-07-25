import express from 'express';
import type { Request, Response } from 'express';
import type { Server } from 'http';
import { metrics } from './updateFlow';
import { logger } from './logger';
import type { TDdnsConfig } from './config';

/**
 * Lightweight HTTP server exposing /health and /metrics for monitoring
 * (PM2 healthcheck, uptime dashboards, etc.). Listens on localhost only.
 */
export const createHttpServer = (config: TDdnsConfig): express.Express => {
  const app = express();

  app.get('/health', (_req: Request, res: Response): void => {
    res.json({
      status: 'ok',
      currentIp: metrics.currentIp,
      lastSuccessfulUpdateAt: metrics.lastUpdateAt,
      hostname: config.DDNS_HOSTNAME,
    });
  });

  app.get('/metrics', (_req: Request, res: Response): void => {
    res.json({
      currentIp: metrics.currentIp,
      lastSuccessfulUpdateAt: metrics.lastUpdateAt,
      uptimeSeconds: process.uptime(),
      successfulUpdates: metrics.successfulUpdates,
      failedUpdates: metrics.failedUpdates,
    });
  });

  return app;
};

export const startHttpServer = (config: TDdnsConfig): Server => {
  const app = createHttpServer(config);
  return app.listen(config.HTTP_PORT, 'localhost', () => {
    logger.info(`HTTP server listening on http://localhost:${config.HTTP_PORT}`);
  });
};




