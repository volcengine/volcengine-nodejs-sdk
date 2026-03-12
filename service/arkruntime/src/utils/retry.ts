export interface RetryPolicy {
  maxAttempts: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
}

/**
 * Calculate retry delay using ExponentialWithRandomJitter strategy.
 * Algorithm aligned with sdk-core calculateRetryDelay
 * (packages/sdk-core/src/utils/retry.ts).
 */
function calculateRetryDelay(
  attemptNumber: number,
  minRetryDelay: number,
  maxRetryDelay: number,
): number {
  const base = Math.min(
    minRetryDelay * Math.pow(2, attemptNumber - 1),
    maxRetryDelay,
  );
  return Math.floor(Math.min(maxRetryDelay, base + Math.random() * base));
}

/**
 * Retry a function with exponential backoff and jitter.
 * Respects AbortSignal for cancellation.
 */
export async function retry<T>(
  policy: RetryPolicy,
  fn: () => Promise<T>,
  isRetryable: (err: unknown) => boolean,
  signal?: AbortSignal,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= policy.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (!isRetryable(err)) {
        throw err;
      }
      if (attempt === policy.maxAttempts) {
        break;
      }

      const delayMs = calculateRetryDelay(
        attempt + 1,
        policy.initialBackoffMs,
        policy.maxBackoffMs,
      );

      await sleep(delayMs, signal);
    }
  }
  throw lastError;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}
