[← 重试策略](6-Retry-zh.md) | 错误处理 [(English)](7-ErrorHandling.md) | [调试模式 →](8-Debugging-zh.md)

---

## 异常处理

当请求失败时，SDK 会抛出 `HttpRequestError` 的实例。该错误对象包含丰富的调试信息。

### 异常类型

`HttpRequestError` 有三种 `name` 类型：

| name | 含义 | 可用字段 |
| --- | --- | --- |
| `ApiException` | 收到服务端的错误响应（参数错误、资源不存在等） | `status`, `data` |
| `NetworkError` | 网络层面的错误（DNS 解析失败、连接超时等） | `message`, `originalError` |
| `Exception` | 其他未归类异常 | `message` |

### 代码示例

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

### 资源清理

客户端可能持有网络连接等资源。在应用退出前，调用 `destroy` 方法释放资源。

```typescript
client.destroy();
```

---

[← 重试策略](6-Retry-zh.md) | 错误处理 [(English)](7-ErrorHandling.md) | [调试模式 →](8-Debugging-zh.md)
