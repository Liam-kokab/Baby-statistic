import { fetchPublicIp } from './services/ipService';
import { getCurrentIp, setCurrentIp } from './services/stateService';
import { appendIpHistory } from './services/historyService';
import { updateDomeneshopIp } from './services/domeneshopClient';
import { logger } from './logger';
import type { TDdnsConfig } from './config';

export type TUpdateMetrics = {
  currentIp: string | null;
  lastUpdateAt: string | null;
  successfulUpdates: number;
  failedUpdates: number;
  startedAt: string;
};

export const metrics: TUpdateMetrics = {
  currentIp: getCurrentIp(),
  lastUpdateAt: null,
  successfulUpdates: 0,
  failedUpdates: 0,
  startedAt: new Date().toISOString(),
};

/**
 * Full DDNS update cycle:
 *  1. Retrieve the current public IP.
 *  2. Compare it with the stored IP — exit early if unchanged.
 *  3. Update Domeneshop's A record.
 *  4. Append the new IP to the history log.
 *  5. Save the new IP as the current IP — only after a successful update.
 */
export const runUpdateFlow = async (config: TDdnsConfig): Promise<void> => {
  logger.info('Update check started');

  const previousIp = getCurrentIp();
  logger.info('Previous stored IP', { previousIp });

  const currentIp = await fetchPublicIp({
    providerUrl: config.IP_PROVIDER_URL,
    retryMaxAttempts: config.RETRY_MAX_ATTEMPTS,
    retryBaseDelayMs: config.RETRY_BASE_DELAY_MS,
  });
  logger.info('Detected current public IP', { currentIp });

  if (currentIp === previousIp) {
    logger.info('IP unchanged — no update needed', { currentIp });
    return;
  }

  logger.info('IP changed — attempting Domeneshop update', { previousIp, currentIp, hostname: config.DDNS_HOSTNAME });

  try {
    await updateDomeneshopIp(config.DDNS_HOSTNAME, currentIp, {
      token: config.DOMENESHOP_TOKEN,
      secret: config.DOMENESHOP_SECRET,
      retryMaxAttempts: config.RETRY_MAX_ATTEMPTS,
      retryBaseDelayMs: config.RETRY_BASE_DELAY_MS,
    });
  } catch (error) {
    metrics.failedUpdates += 1;
    logger.error('Domeneshop update failed — not saving new IP', {
      previousIp,
      currentIp,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  appendIpHistory(currentIp);
  setCurrentIp(currentIp);

  metrics.currentIp = currentIp;
  metrics.lastUpdateAt = new Date().toISOString();
  metrics.successfulUpdates += 1;

  logger.info('Domeneshop update succeeded', { previousIp, currentIp, hostname: config.DDNS_HOSTNAME });
};

