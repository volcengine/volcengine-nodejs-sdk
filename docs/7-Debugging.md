[← Error Handling](6-ErrorHandling.md) | Debugging [(中文)](7-Debugging-zh.md) | [Overview →](0-Overview.md)

---

## Debug Mechanism

The SDK provides built-in debug logging via the `debugOptions` field for troubleshooting.

### Enable Debug Mode

> **Default**
>
> - `debug` — `false`

```typescript
import { EcsClient, LogLevel } from "@volcengine/sdk-core";

const client = new EcsClient({
  region: "cn-beijing",
  debugOptions: {
    debug: true,
  },
});
```

### Set Debug Level

Use the `logLevel` field with bitmask for fine-grained control:

```typescript
const client = new EcsClient({
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

#### Supported Log Levels

| Enum Value                       | Content                       |
| -------------------------------- | ----------------------------- |
| `LOG_DEBUG_WITH_REQUEST`         | Request method, URL, headers  |
| `LOG_DEBUG_WITH_REQUEST_BODY`    | Request body                  |
| `LOG_DEBUG_WITH_REQUEST_ID`      | RequestId                     |
| `LOG_DEBUG_WITH_RESPONSE`        | Response status code, headers |
| `LOG_DEBUG_WITH_RESPONSE_BODY`   | Response body                 |
| `LOG_DEBUG_WITH_SIGNING`         | Signing process               |
| `LOG_DEBUG_WITH_ENDPOINT`        | Endpoint resolution           |
| `LOG_DEBUG_WITH_REQUEST_RETRIES` | Retry information             |
| `LOG_DEBUG_WITH_CONFIG`          | Key configuration info        |
| `LOG_DEBUG_ALL`                  | All of the above              |

### Specify Logger

> **Default**
>
> - `loggerFile` — `undefined` (output to stderr)
> - `loggerFormat` — default format

```typescript
const client = new EcsClient({
  region: "cn-beijing",
  debugOptions: {
    debug: true,
    loggerFile: "/var/log/volcengine-sdk-debug.log",
    loggerFormat: "[%(timestamp)s] %(level)s - %(message)s",
  },
});
```

#### Custom Logger

```typescript
import type { DebugLogger } from "@volcengine/sdk-core";

const customLogger: DebugLogger = {
  debug: (message: string) => {
    console.log(`[SDK Debug] ${message}`);
  },
};

const client = new EcsClient({
  region: "cn-beijing",
  debugOptions: {
    debug: true,
    logger: customLogger,
  },
});
```

> **Note**: The built-in debug feature automatically masks sensitive headers (`Authorization`, `X-Security-Token`) and truncates large request/response bodies.

### Custom Middleware Debugging

For advanced debugging beyond `debugOptions`:

```typescript
import { EcsClient } from "@volcengine/ecs";

const client = new EcsClient({ region: "cn-beijing" });

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

[← Error Handling](6-ErrorHandling.md) | Debugging [(中文)](7-Debugging-zh.md) | [Overview →](0-Overview.md)
