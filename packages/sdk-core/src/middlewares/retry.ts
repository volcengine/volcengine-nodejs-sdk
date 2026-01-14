import type { Clock } from "../types/clock";
import type { Args, MiddlewareFunction, MiddlewareStackOptions } from "./types";
import { PRIORITY } from "./priority";
import type { RetryStrategy } from "../types/types";

export function createRetryMiddleware(
  clock: Clock,
  shouldRetry: (error: any) => boolean,
  calculateRetryDelay: (
    attemptNumber: number,
    retryStrategy?: RetryStrategy
  ) => number
): {
  middleware: MiddlewareFunction;
  options: MiddlewareStackOptions;
} {
  const middleware: MiddlewareFunction =
    (next, context) => async (args: Args) => {
      const clientConfig = context.clientConfig || {};

      // Determine maxAttempts
      // If autoRetry is explicitly false, maxAttempts is 1 (no retry)
      // Otherwise, use configured maxRetries (default 3) to calculate maxAttempts
      let maxAttempts = 4; // Default: 1 attempt + 3 retries
      if (clientConfig.autoRetry === false) {
        maxAttempts = 1;
      } else if (typeof clientConfig.maxRetries === "number") {
        // 如果小于等于0，默认不进行重试
        maxAttempts = Math.max(clientConfig.maxRetries + 1, 1);
      }

      const customRetryStrategy = clientConfig.retryStrategy;

      let lastError: any;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const result = await next(args);
          return result;
        } catch (error: any) {
          lastError = error;

          const shouldRetryFlag =
            attempt < maxAttempts &&
            (customRetryStrategy?.retryIf
              ? customRetryStrategy.retryIf(error)
              : shouldRetry(error));
          if (!shouldRetryFlag) {
            break;
          }

          let delayMs: number;
          if (customRetryStrategy?.delay) {
            delayMs = customRetryStrategy.delay(attempt);
          } else {
            delayMs = calculateRetryDelay(attempt, customRetryStrategy);
          }

          if (delayMs > 0 && attempt < maxAttempts) {
            await clock.sleep(delayMs);
          }
        }
      }

      throw lastError;
    };

  const options: MiddlewareStackOptions = {
    step: PRIORITY.retryMiddleware.step,
    name: "retryMiddleware",
    priority: PRIORITY.retryMiddleware.priority,
  };

  return { middleware, options };
}
