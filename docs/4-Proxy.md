[← Transport](3-Transport.md) | Proxy [(中文)](4-Proxy-zh.md) | [Timeouts →](5-Timeout.md)

---

## HTTP(S) Proxy Configuration

> **Default**
>
> - No proxy

### Configure in Code

```typescript
const client = new ECSClient({
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

### STS Provider Proxy Configuration

`StsAssumeRoleProvider`, `OidcCredentialProvider`, and `SamlCredentialProvider` support proxy configuration through `proxyUrl`.

```typescript
import { StsAssumeRoleProvider } from "@volcengine/sdk-core";

const credentialProvider = new StsAssumeRoleProvider({
  accessKeyId: "ASSUME_ROLE_CALLER_AK",
  secretAccessKey: "ASSUME_ROLE_CALLER_SK",
  roleTrn: "trn:iam::2110400000:role/role123",
  region: "cn-beijing",
  proxyUrl: "http://127.0.0.1:8080",
});
```

`proxyUrl` is optional and supports the following formats:

- `http://host:port`
- `http://user:password@host:port`
- `https://host:port`
- `https://user:password@host:port`

Priority:

- When `proxyUrl` is non-empty and valid, `proxyUrl` takes precedence
- When `proxyUrl` is an empty string or not set, it falls back to environment proxy configuration
- When `proxyUrl` is non-empty but invalid, an error is thrown directly

---

[← Transport](3-Transport.md) | Proxy [(中文)](4-Proxy-zh.md) | [Timeouts →](5-Timeout.md)
