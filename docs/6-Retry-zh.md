[← 超时配置](5-Timeout-zh.md) | 重试策略 [(English)](6-Retry.md) | [错误处理 →](7-ErrorHandling-zh.md)

---

## 重试机制

请求的处理逻辑内置了网络异常重试逻辑，即当遇到网络异常问题或限流错误时，系统会自动尝试重新发起请求。若请求因业务逻辑错误而报错（如参数错误、资源不存在等），SDK 不会执行重试。

### 开启与配置重试

> **默认**
>
> - `autoRetry` — `true`
> - `maxRetries` — 3（总共尝试 4 次）

```typescript
const client = new ECSClient({
  region: "cn-beijing",
  // autoRetry: false,  // 完全禁用重试
  maxRetries: 5,
});
```

### 重试条件

SDK 只会对特定的错误进行重试：

1. 网络错误（如 `ECONNRESET`, `ETIMEDOUT` 等）
2. HTTP 状态码为 `429`, `500`, `502`, `503`, `504` 的服务端错误

### 退避策略

> **默认**
>
> - `ExponentialWithRandomJitterBackoffStrategy`
> - `minRetryDelay` — 300ms
> - `maxRetryDelay` — 300000ms (5 分钟)

边界值说明：`minRetryDelay` 最小延迟时间，`maxRetryDelay` 最大延迟时间，`n` 为当前重试次数（从 1 开始）。

| 策略名称                                     | 说明                     | 公式                                                                                                       |
| -------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `NoBackoffStrategy`                          | 不使用退避，立即重试     | `delay = 0`                                                                                                |
| `ExponentialBackoffStrategy`                 | 指数退避                 | `delay = min(minRetryDelay * 2^(n-1), maxRetryDelay)`                                                      |
| `ExponentialWithRandomJitterBackoffStrategy` | 带抖动的指数退避（默认） | `base = min(minRetryDelay * 2^(n-1), maxRetryDelay)`, `delay = min(base + random(0, base), maxRetryDelay)` |

```typescript
import { StrategyName } from "@volcengine/sdk-core";

const client = new ECSClient({
  region: "cn-beijing",
  strategyName: StrategyName.ExponentialWithRandomJitterBackoffStrategy,
});
```

### 自定义重试策略

通过 `retryStrategy` 字段，你可以更精细地控制重试行为：

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

[← 超时配置](5-Timeout-zh.md) | 重试策略 [(English)](6-Retry.md) | [错误处理 →](7-ErrorHandling-zh.md)
