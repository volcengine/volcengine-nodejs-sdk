[← 错误处理](6-ErrorHandling-zh.md) | 调试模式 [(English)](7-Debugging.md) | [概览 →](0-Overview-zh.md)

---

## Debug 机制

为便于在处理请求时进行问题排查和调试，SDK 支持日志功能，并提供多种日志级别设置。

### 开启 Debug 模式

> **默认**
>
> - `debug` — `false`

```typescript
import { ECSClient } from "@volcengine/ecs";
import { LogLevel } from "@volcengine/sdk-core";

const client = new ECSClient({
  region: "cn-beijing",
  debugOptions: {
    debug: true,
  },
});
```

### 设置 Debug 级别

通过 `logLevel` 字段可以使用位掩码精确控制要输出的日志类型：

```typescript
const client = new ECSClient({
  region: "cn-beijing",
  debugOptions: {
    debug: true,
    logLevel:
      LogLevel.LOG_DEBUG_WITH_REQUEST |
      LogLevel.LOG_DEBUG_WITH_RESPONSE |
      LogLevel.LOG_DEBUG_WITH_REQUEST_RETRIES,
  },
});
```

#### 支持的日志级别

| 枚举项                           | 打印的内容            |
| -------------------------------- | --------------------- |
| `LOG_DEBUG_WITH_REQUEST`         | 请求方法、URL、请求头 |
| `LOG_DEBUG_WITH_REQUEST_BODY`    | 请求体                |
| `LOG_DEBUG_WITH_REQUEST_ID`      | RequestId             |
| `LOG_DEBUG_WITH_RESPONSE`        | 响应状态码、响应头    |
| `LOG_DEBUG_WITH_RESPONSE_BODY`   | 响应体                |
| `LOG_DEBUG_WITH_SIGNING`         | 签名过程              |
| `LOG_DEBUG_WITH_ENDPOINT`        | Endpoint 选择过程     |
| `LOG_DEBUG_WITH_REQUEST_RETRIES` | 重试信息              |
| `LOG_DEBUG_WITH_CONFIG`          | 关键配置信息          |
| `LOG_DEBUG_ALL`                  | 包含上面所有信息      |

### 指定日志 Logger

> **默认**
>
> - `loggerFile` — `undefined`（输出到 stderr）
> - `loggerFormat` — 默认格式

```typescript
const client = new ECSClient({
  region: "cn-beijing",
  debugOptions: {
    debug: true,
    loggerFile: "/var/log/volcengine-sdk-debug.log",
    loggerFormat: "[%(timestamp)s] %(level)s - %(message)s",
  },
});
```

#### 自定义 Logger

```typescript
import type { DebugLogger } from "@volcengine/sdk-core";

const customLogger: DebugLogger = {
  debug: (message: string) => {
    console.log(`[SDK Debug] ${message}`);
  },
};

const client = new ECSClient({
  region: "cn-beijing",
  debugOptions: {
    debug: true,
    logger: customLogger,
  },
});
```

> **说明**: 内置调试功能会自动对 `Authorization`、`X-Security-Token` 等敏感请求头进行脱敏处理，并自动截断过长的请求/响应体。

### 自定义中间件调试

如果内置的 `debugOptions` 无法满足需求，可以通过注入自定义中间件来实现更灵活的调试逻辑：

```typescript
import { ECSClient } from "@volcengine/ecs";

const client = new ECSClient({ region: "cn-beijing" });

client.middlewareStack.add(
  (next, context) => async (args) => {
    const { request } = args;
    console.log(
      "👉 [Request]:",
      request.method,
      request.protocol + "://" + request.host + request.pathname,
    );

    const result = await next(args);

    const { response } = result;
    if (response) {
      console.log("👈 [Response]:", response.status, response.statusText);
    }

    return result;
  },
  {
    step: "finalizeRequest",
    name: "LogMiddleware",
    priority: 200,
  },
);
```

---

[← 错误处理](6-ErrorHandling-zh.md) | 调试模式 [(English)](7-Debugging.md) | [概览 →](0-Overview-zh.md)
