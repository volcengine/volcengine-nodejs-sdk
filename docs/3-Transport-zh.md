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

### STS Provider TLS 配置

`StsAssumeRoleProvider`、`OidcCredentialProvider`、`SamlCredentialProvider` 还支持以下可选 TLS 配置：

- `caFile`：自定义 CA 证书文件路径
- `insecureSkipVerify`：是否跳过 TLS 证书校验，默认 `false`，仅限联调，生产禁用

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

[← Endpoint 配置](2-Endpoint-zh.md) | Transport [(English)](3-Transport.md) | [代理配置 →](4-Proxy-zh.md)
