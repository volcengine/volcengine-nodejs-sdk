[← Retries](6-Retry.md) | Error Handling [(中文)](7-ErrorHandling-zh.md) | [Debugging →](8-Debugging.md)

---

## Exception Handling

When a request fails, the SDK throws an instance of `HttpRequestError` containing rich debugging information.

### Exception Types

| name | Meaning | Available Fields |
| --- | --- | --- |
| `ApiException` | Server error response (parameter error, resource not found, etc.) | `status`, `data` |
| `NetworkError` | Network-level error (DNS failure, connection timeout, etc.) | `message`, `originalError` |
| `Exception` | Other unclassified exceptions | `message` |

### Code Example

```typescript
import { HttpRequestError } from "@volcengine/sdk-core";

try {
  await client.send(command);
} catch (error) {
  if (error instanceof HttpRequestError) {
    if (error.status !== undefined) {
      if (error.status === 0) {
        console.error("SSL Error");
      } else {
        if (error.data?.ResponseMetadata?.Error) {
          const { Code, Message } = error.data.ResponseMetadata.Error;
          const { RequestId } = error.data.ResponseMetadata;
          console.error(`API Error [${Code}]: ${Message}, RequestId: ${RequestId}`);
        }
      }
    } else if (error.name === "NetworkError") {
      console.error(`Network Error: ${error.message}`);
      if (error.originalError && (error.originalError as any).code) {
        console.error(`Code: ${(error.originalError as any).code}`);
      }
    } else {
      console.error("SDK Exception");
    }
  }
}
```

### Resource Cleanup

The client may hold resources such as network connections. Call `destroy` before the application exits.

```typescript
client.destroy();
```

---

[← Retries](6-Retry.md) | Error Handling [(中文)](7-ErrorHandling-zh.md) | [Debugging →](8-Debugging.md)
