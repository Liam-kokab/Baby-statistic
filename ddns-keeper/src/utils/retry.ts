import { logger } from '../logger';

/**
 * Error type that carries an HTTP status code, letting retryWithBackoff decide
 * whether a failure is retryable (5xx / network) or not (4xx).
 */
export class HttpStatusError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpStatusError';
    this.status = status;
  }
}

export type TRetryOptions = {
  maxAttempts: number;
  baseDelayMs: number;
  operationName: string;
};

const isNonRetryableStatus = (error: unknown): boolean =>
  error instanceof HttpStatusError && error.status >= 400 && error.status < 500;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries `fn` up to `maxAttempts` times using exponential backoff
 * (baseDelayMs * 2^attempt). Does not retry 4xx HttpStatusErrors — those are
 * treated as permanent client errors and rethrown immediately.
 */
export const retryWithBackoff = async <T>(fn: () => Promise<T>, options: TRetryOptions): Promise<T> => {
  const { maxAttempts, baseDelayMs, operationName } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (isNonRetryableStatus(error)) {
        logger.error(`${operationName} failed with non-retryable client error`, {
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }

      const isLastAttempt = attempt === maxAttempts;
      logger.warn(`${operationName} failed (attempt ${attempt}/${maxAttempts})`, {
        error: error instanceof Error ? error.message : String(error),
        willRetry: !isLastAttempt,
      });

      if (!isLastAttempt) {
        const delay = baseDelayMs * 2 ** (attempt - 1);
        await sleep(delay);
      }
    }
  }

  throw lastError;
};

