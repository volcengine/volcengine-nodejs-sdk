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

### STS Provider TLS Configuration

`StsAssumeRoleProvider`, `OidcCredentialProvider`, and `SamlCredentialProvider` also support the following optional TLS settings:

- `caFile`: path to a custom CA certificate file
- `insecureSkipVerify`: whether to skip TLS certificate verification, default `false`, for debugging only, do not use in production

```typescript
import { StsAssumeRoleProvider } from "@volcengine/sdk-core";

const credentialProvider = new StsAssumeRoleProvider({
  accessKeyId: "ASSUME_ROLE_CALLER_AK",
  secretAccessKey: "ASSUME_ROLE_CALLER_SK",
  roleTrn: "trn:iam::2110400000:role/role123",
  region: "cn-beijing",
  caFile: "/path/to/custom-ca.pem",
  insecureSkipVerify: false,
});
```

---

[← Endpoint Configuration](2-Endpoint.md) | Transport [(中文)](3-Transport-zh.md) | [Proxy →](4-Proxy.md)
