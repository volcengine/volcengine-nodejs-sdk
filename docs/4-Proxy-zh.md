[← Transport](3-Transport-zh.md) | 代理配置 [(English)](4-Proxy.md) | [超时配置 →](5-Timeout-zh.md)

---

## HTTP(S) 代理配置

> **默认**
>
> - 无代理

### 在代码中配置

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

### 使用环境变量

SDK 会自动读取以下环境变量来配置代理：

- `VOLC_PROXY_PROTOCOL`：代理协议（`http` 或 `https`）
- `VOLC_PROXY_HOST`：代理主机
- `VOLC_PROXY_PORT`：代理端口

优先级：代码配置 > 环境变量。

### STS Provider 代理配置

`StsAssumeRoleProvider`、`OidcCredentialProvider`、`SamlCredentialProvider` 支持通过 `proxyUrl` 配置代理。

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

`proxyUrl` 为可选参数，支持以下格式：

- `http://host:port`
- `http://user:password@host:port`
- `https://host:port`
- `https://user:password@host:port`

优先级说明：

- `proxyUrl` 非空且合法时，优先使用 `proxyUrl`
- `proxyUrl` 为空字符串或未设置时，回退到环境变量代理
- `proxyUrl` 非空但非法时，直接报错

---

[← Transport](3-Transport-zh.md) | 代理配置 [(English)](4-Proxy.md) | [超时配置 →](5-Timeout-zh.md)
