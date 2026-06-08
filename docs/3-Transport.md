[← Endpoint Configuration](2-Endpoint.md) | Transport [(中文)](3-Transport-zh.md) | [Proxy →](4-Proxy.md)

---

## Protocol Scheme

> **Default**
>
> - `protocol` — `https`

```typescript
const client = new ECSClient({
  protocol: "http",
  region: "cn-beijing",
});
```

## Ignore SSL Verification

> **Default**
>
> - `ignoreSSL` — `false`

> ⚠️ **Warning**: Ignoring SSL verification in production poses serious security risks. Use only in confirmed safe test environments.

```typescript
const client = new ECSClient({
  region: "cn-beijing",
  httpOptions: {
    ignoreSSL: true,
  },
});
```

## Connection Pool Configuration

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

[← Endpoint Configuration](2-Endpoint.md) | Transport [(中文)](3-Transport-zh.md) | [Proxy →](4-Proxy.md)
