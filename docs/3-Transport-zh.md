[← Endpoint 配置](2-Endpoint-zh.md) | Transport [(English)](3-Transport.md) | [超时配置 →](4-Timeout-zh.md)

---

## 协议 Scheme

> **默认**
>
> - `protocol` — `https`

```typescript
const client = new EcsClient({
  protocol: "http",
  region: "cn-beijing",
});
```

## 忽略 SSL 验证

> **默认**
>
> - `ignoreSSL` — `false`

> ⚠️ **警告**：在生产环境中忽略 SSL 验证会带来严重的安全风险。请仅在确认安全的测试环境中使用。

```typescript
const client = new EcsClient({
  region: "cn-beijing",
  httpOptions: {
    ignoreSSL: true,
  },
});
```

## HTTP(S) 代理配置

> **默认**
>
> - 无代理

### 在代码中配置

```typescript
const client = new EcsClient({
  region: "cn-beijing",
  httpOptions: {
    proxy: {
      protocol: "http",
      host: "127.0.0.1",
      port: 8888,
    },
  },
});
```

### 使用环境变量

SDK 会自动读取以下环境变量来配置代理：

- `VOLC_PROXY_PROTOCOL`：代理协议（`http` 或 `https`）
- `VOLC_PROXY_HOST`：代理主机
- `VOLC_PROXY_PORT`：代理端口

优先级：代码配置 > 环境变量。

## 连接池配置

SDK 支持自定义 HTTP 连接池配置：

```typescript
const client = new EcsClient({
  region: "cn-beijing",
  httpOptions: {
    pool: {
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 50,
      maxFreeSockets: 10,
    },
  },
});
```

---

[← Endpoint 配置](2-Endpoint-zh.md) | Transport [(English)](3-Transport.md) | [超时配置 →](4-Timeout-zh.md)
