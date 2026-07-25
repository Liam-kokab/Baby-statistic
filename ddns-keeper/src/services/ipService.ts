import { HttpStatusError, retryWithBackoff } from '../utils/retry';
import { logger } from '../logger';

const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;

export const isValidIPv4 = (value: string): boolean => IPV4_REGEX.test(value);

export type TIpServiceOptions = {
  providerUrl: string;
  retryMaxAttempts: number;
  retryBaseDelayMs: number;
};

/**
 * Fetches the current public IPv4 address from a configurable provider,
 * trims whitespace, validates the result, and retries transient failures
 * with exponential backoff. Throws a descriptive error on any failure.
 */
export const fetchPublicIp = async ({
  providerUrl,
  retryMaxAttempts,
  retryBaseDelayMs,
}: TIpServiceOptions): Promise<string> =>
  retryWithBackoff(
    async () => {
      let response: Response;
      try {
        response = await fetch(providerUrl);
      } catch (error) {
        throw new Error(
          `Failed to reach IP provider (${providerUrl}): ${error instanceof Error ? error.message : String(error)}`
        );
      }

      if (!response.ok) {
        throw new HttpStatusError(
          `IP provider (${providerUrl}) responded with status ${response.status}`,
          response.status
        );
      }

      const rawBody = await response.text();
      const ip = rawBody.trim();

      if (!isValidIPv4(ip)) {
        throw new Error(`IP provider (${providerUrl}) returned an invalid IPv4 address: "${ip}"`);
      }

      return ip;
    },
    {
      maxAttempts: retryMaxAttempts,
      baseDelayMs: retryBaseDelayMs,
      operationName: 'fetchPublicIp',
    }
  ).catch((error) => {
    logger.error('fetchPublicIp: giving up after retries', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  });

