[← Transport](3-Transport.md) | Timeouts [(中文)](4-Timeout-zh.md) | [Retries →](5-Retry.md)

---

## Timeout Configuration

> **Default**
>
> - `timeout` — 30000ms (30 seconds)

### Client Level Timeout

Set via `httpOptions.timeout` when creating the client. This becomes the default timeout for all requests.

```typescript
const client = new ECSClient({
  region: "cn-beijing",
  httpOptions: {
    timeout: 5000,
  },
});
```

### Request Level Timeout

Specify timeout for a single request via `options.timeout` when calling `send`. This overrides the client-level setting.

```typescript
await client.send(slowCommand, { timeout: 30000 });
```

### Connect Timeout and Read Timeout

For more fine-grained control:

- **`connectTimeout`**: TCP connection timeout (milliseconds). Implemented by overriding the Agent's `createConnection` method with a custom timer on the socket — covers only the TCP handshake phase (not TLS handshake). If TLS negotiation stalls, `readTimeout` will act as a fallback.
- **`readTimeout`**: Overall request-response timeout (milliseconds). Maps to the axios `timeout`, covering the entire lifecycle from request sent to response received.

When `readTimeout` is not set, it falls back to `timeout` for backward compatibility.

```typescript
const client = new ECSClient({
  region: "cn-beijing",
  httpOptions: {
    connectTimeout: 3000,
    readTimeout: 30000,
  },
});
```

> **Note**: If both `readTimeout` and `timeout` are specified, `readTimeout` takes precedence. `connectTimeout` independently controls the initial connection phase.

---

[← Transport](3-Transport.md) | Timeouts [(中文)](4-Timeout-zh.md) | [Retries →](5-Retry.md)
