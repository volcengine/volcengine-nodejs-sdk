[← Transport](3-Transport-zh.md) | 超时配置 [(English)](4-Timeout.md) | [重试策略 →](5-Retry-zh.md)

---

## 超时配置

> **默认**
>
> - `timeout` — 30000ms (30 秒)

### 客户端级别超时

在创建客户端时通过 `httpOptions.timeout` 设置，这将成为所有请求的默认超时时间。

```typescript
const client = new EcsClient({
  region: "cn-beijing",
  httpOptions: {
    timeout: 5000,
  },
});
```

### 请求级别超时

在调用 `send` 方法时，通过 `options.timeout` 为单个请求指定超时时间。此配置会覆盖客户端级别的设置。

```typescript
await client.send(slowCommand, { timeout: 30000 });
```

### 连接超时与读取超时拆分

SDK 支持更细粒度的超时控制：

- **`connectTimeout`**: TCP 连接超时时间（毫秒）。通过重写底层 Agent 的 `createConnection` 方法，在 socket 创建后设置定时器实现，仅覆盖 TCP 握手阶段（不含 TLS 握手）。若 TLS 握手卡住，`readTimeout` 会兜底。
- **`readTimeout`**: 整体请求-响应超时时间（毫秒）。映射到 axios 的 `timeout`，覆盖从请求发出到响应接收完毕的全过程。

当 `readTimeout` 未设置时，会回退到 `timeout` 的值，以保持向后兼容。

```typescript
const client = new EcsClient({
  region: "cn-beijing",
  httpOptions: {
    connectTimeout: 3000,
    readTimeout: 30000,
  },
});
```

> **说明**: 当同时设置了 `readTimeout` 和 `timeout` 时，`readTimeout` 优先生效。`connectTimeout` 独立控制初始连接阶段。

---

[← Transport](3-Transport-zh.md) | 超时配置 [(English)](4-Timeout.md) | [重试策略 →](5-Retry-zh.md)
