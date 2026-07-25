import { HttpStatusError, retryWithBackoff } from '../utils/retry';
import { logger } from '../logger';

const DOMENESHOP_API_BASE = 'https://api.domeneshop.no/v0';

export type TDomeneshopClientOptions = {
  token: string;
  secret: string;
  retryMaxAttempts: number;
  retryBaseDelayMs: number;
};

/**
 * Updates the A record for `hostname` via Domeneshop's DDNS "IP update
 * protocol" endpoint (GET /dyndns/update), using HTTP Basic Auth
 * (token = username, secret = password). `myip` is always passed explicitly
 * so the update is never left to Domeneshop's automatic client-IP detection.
 * Retries transient failures with exponential backoff; does not retry 4xx.
 */
export const updateDomeneshopIp = async (
  hostname: string,
  ip: string,
  { token, secret, retryMaxAttempts, retryBaseDelayMs }: TDomeneshopClientOptions
): Promise<void> => {
  const url = new URL(`${DOMENESHOP_API_BASE}/dyndns/update`);
  url.searchParams.set('hostname', hostname);
  url.searchParams.set('myip', ip);

  const authHeader = `Basic ${Buffer.from(`${token}:${secret}`).toString('base64')}`;

  await retryWithBackoff(
    async () => {
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'GET',
          headers: { Authorization: authHeader },
        });
      } catch (error) {
        throw new Error(
          `Failed to reach Domeneshop API: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new HttpStatusError(
          `Domeneshop DDNS update failed for hostname "${hostname}" (status ${response.status}): ${body || response.statusText}`,
          response.status
        );
      }
    },
    {
      maxAttempts: retryMaxAttempts,
      baseDelayMs: retryBaseDelayMs,
      operationName: 'updateDomeneshopIp',
    }
  ).catch((error) => {
    logger.error('updateDomeneshopIp: giving up after retries', {
      hostname,
      ip,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  });
};

