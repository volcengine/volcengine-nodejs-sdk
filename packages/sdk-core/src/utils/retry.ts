import { StrategyName, RetryStrategy } from "../types/types";

/**
 * Determine if an error should be retried
 * Default retry strategy: retry network errors and 5xx server errors
 */
export function shouldRetry(error: any): boolean {
  // Check original error (for wrapped HttpRequestError)
  const originalError = (error as any).originalError || error;

  // Retry network errors (ECONNRESET, ETIMEDOUT, ECONNABORTED, ECONNREFUSED, etc.)
  if (
    (originalError as any).code &&
    ((originalError as any).code === "ECONNRESET" ||
      (originalError as any).code === "ETIMEDOUT" ||
      (originalError as any).code === "ECONNABORTED" ||
      (originalError as any).code === "ECONNREFUSED" ||
      (originalError as any).code === "ENOTFOUND" ||
      (originalError as any).code === "EPIPE")
  ) {
    return true;
  }

  // Check status from HttpRequestError (error.status) or original error (error.response?.status)
  const status = (error as any).status || (error as any).response?.status;

  // Retry 5xx,4xx server errors
  if (status && [500, 502, 503, 504, 429].includes(status)) {
    return true;
  }

  // Don't retry other errors
  return false;
}

/**
 * Calculate retry delay (milliseconds)
 */
export function calculateRetryDelay(
  attemptNumber: number,
  retryStrategy?: RetryStrategy
): number {
  const strategyName =
    retryStrategy?.strategyName ||
    StrategyName.ExponentialWithRandomJitterBackoffStrategy;
  const minRetryDelay = retryStrategy?.minRetryDelay ?? 300; // Default 300ms
  const maxRetryDelay = retryStrategy?.maxRetryDelay ?? 300 * 1000; // Default 300s

  if (strategyName === StrategyName.NoBackoffStrategy) {
    return 0;
  }

  if (strategyName === StrategyName.ExponentialBackoffStrategy) {
    // delay = min(min_retry_delay * 2^n, max_retry_delay)
    return Math.min(
      minRetryDelay * Math.pow(2, attemptNumber - 1),
      maxRetryDelay
    );
  }

  // Default to ExponentialWithRandomJitterBackoffStrategy

  const base = Math.min(
    minRetryDelay * Math.pow(2, attemptNumber - 1),
    maxRetryDelay
  );
  return Math.floor(Math.min(maxRetryDelay, base + Math.random() * base));
}
