[← Timeouts](5-Timeout.md) | Retries [(中文)](6-Retry-zh.md) | [Error Handling →](7-ErrorHandling.md)

---

## Retry Mechanism

The SDK has built-in automatic retry logic for network errors and throttling. Business logic errors (e.g., parameter errors, resource not found) will not trigger retries.

### Enable and Configure Retry

> **Default**
>
> - `autoRetry` — `true`
> - `maxRetries` — 3 (total 4 attempts)

```typescript
const client = new ECSClient({
  region: "cn-beijing",
  // autoRetry: false,  // Completely disable retry
  maxRetries: 5,
});
```

### Retry Conditions

The SDK retries on:

1. Network errors (e.g., `ECONNRESET`, `ETIMEDOUT`)
2. HTTP status codes `429`, `500`, `502`, `503`, `504`

### Backoff Strategies

> **Default**
>
> - `ExponentialWithRandomJitterBackoffStrategy`
> - `minRetryDelay` — 300ms
> - `maxRetryDelay` — 300000ms (5 minutes)

Where `minRetryDelay` is minimum delay, `maxRetryDelay` is maximum delay, `n` is the current retry attempt number (starting from 1).

| Strategy | Description | Formula |
| --- | --- | --- |
| `NoBackoffStrategy` | No backoff, retry immediately | `delay = 0` |
| `ExponentialBackoffStrategy` | Exponential backoff | `delay = min(minRetryDelay * 2^(n-1), maxRetryDelay)` |
| `ExponentialWithRandomJitterBackoffStrategy` | Exponential with jitter (default) | `base = min(minRetryDelay * 2^(n-1), maxRetryDelay)`, `delay = min(base + random(0, base), maxRetryDelay)` |

```typescript
import { StrategyName } from "@volcengine/sdk-core";

const client = new ECSClient({
  region: "cn-beijing",
  strategyName: StrategyName.ExponentialWithRandomJitterBackoffStrategy,
});
```

### Custom Retry Strategy

```typescript
const client = new ECSClient({
  region: "cn-beijing",
  retryStrategy: {
    minRetryDelay: 500,
    maxRetryDelay: 20000,

    retryIf: (error) => {
      if (error.data?.ResponseMetadata?.Error?.Code === "ResourceIsBusy") {
        return true;
      }
      return false;
    },

    delay: (attemptNumber) => {
      return 1000;
    },
  },
});
```

---

[← Timeouts](5-Timeout.md) | Retries [(中文)](6-Retry-zh.md) | [Error Handling →](7-ErrorHandling.md)
