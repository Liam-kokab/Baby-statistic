import { getConfig } from './config';
import { runUpdateFlow } from './updateFlow';
import { startHttpServer } from './httpServer';
import { logger } from './logger';

const config = getConfig();
const isOnceMode = process.argv.includes('--once') || process.env.DDNS_RUN_MODE === 'once';

const runOnce = async (): Promise<void> => {
  logger.info('ddns-keeper starting (one-shot mode)', { hostname: config.DDNS_HOSTNAME });
  try {
    await runUpdateFlow(config);
  } catch (error) {
    logger.error('Unexpected exception during update flow', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  }
};

const runContinuous = (): void => {
  logger.info('ddns-keeper starting (continuous mode)', {
    hostname: config.DDNS_HOSTNAME,
    pollIntervalMs: config.POLL_INTERVAL_MS,
    httpPort: config.HTTP_PORT,
  });

  startHttpServer(config);

  const tick = async (): Promise<void> => {
    try {
      await runUpdateFlow(config);
    } catch (error) {
      logger.error('Unexpected exception during update flow', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  void tick();
  setInterval(() => {
    void tick();
  }, config.POLL_INTERVAL_MS);
};

if (isOnceMode) {
  void runOnce();
} else {
  runContinuous();
}

