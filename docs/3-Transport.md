[← Endpoint Configuration](2-Endpoint.md) | Transport [(中文)](3-Transport-zh.md) | [Timeouts →](4-Timeout.md)

---

## Protocol Scheme

> **Default**
>
> - `protocol` — `https`

```typescript
const client = new EcsClient({
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
const client = new EcsClient({
  region: "cn-beijing",
  httpOptions: {
    ignoreSSL: true,
  },
});
```

## HTTP(S) Proxy Configuration

> **Default**
>
> - No proxy

### Configure in Code

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

### Use Environment Variables

The SDK reads the following environment variables:

- `VOLC_PROXY_PROTOCOL`: Proxy protocol (`http` or `https`)
- `VOLC_PROXY_HOST`: Proxy host
- `VOLC_PROXY_PORT`: Proxy port

Priority: Code configuration > environment variables.

## Connection Pool Configuration

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

[← Endpoint Configuration](2-Endpoint.md) | Transport [(中文)](3-Transport-zh.md) | [Timeouts →](4-Timeout.md)
