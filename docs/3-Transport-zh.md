[← Endpoint 配置](2-Endpoint-zh.md) | Transport [(English)](3-Transport.md) | [代理配置 →](4-Proxy-zh.md)

---

## 协议 Scheme

> **默认**
>
> - `protocol` — `https`

```typescript
const client = new ECSClient({
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
const client = new ECSClient({
  region: "cn-beijing",
  httpOptions: {
    ignoreSSL: true,
  },
});
```

## 连接池配置

SDK 支持自定义 HTTP 连接池配置：

```typescript
const client = new ECSClient({
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

[← Endpoint 配置](2-Endpoint-zh.md) | Transport [(English)](3-Transport.md) | [代理配置 →](4-Proxy-zh.md)
