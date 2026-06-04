[← 概览](0-Overview-zh.md) | 访问凭据 [(English)](1-Credentials.md) | [Endpoint 配置 →](2-Endpoint-zh.md)

---

## 访问凭据

为保障资源访问安全，火山引擎 Node.js SDK 支持显式凭证和 `CredentialProvider` 自动解析两种方式。

### CredentialProvider 总览

| Provider                                | 用途                             | 是否自动刷新        | 典型场景           |
| --------------------------------------- | -------------------------------- | ------------------- | ------------------ |
| `StaticCredentialProvider`              | 静态 AK/SK(/Token)               | 否                  | 服务端长期凭证     |
| `StsAssumeRoleProvider`                 | STS AssumeRole                   | 是                  | 角色扮演临时凭证   |
| `OidcCredentialProvider`                | STS AssumeRoleWithOIDC           | 是                  | OIDC 联邦身份      |
| `SamlCredentialProvider`                | STS AssumeRoleWithSAML           | 是                  | SAML 联邦身份      |
| `EnvironmentVariableCredentialProvider` | 读取环境变量                     | 否                  | CI/CD、容器注入    |
| `CLIConfigCredentialProvider`           | 读取 `~/.volcengine/config.json` | 否                  | 复用 CLI 配置      |
| `EcsRoleCredentialProvider`             | 读取 ECS IMDS                    | 是                  | ECS 实例角色       |
| `DefaultCredentialProvider`             | 默认链包装                       | 取决于代理 Provider | 业务代码不写 AK/SK |

### AK/SK 设置

AK/SK 是由火山引擎用户在控制台创建的一对永久访问密钥。SDK 使用该密钥对每次请求进行签名，从而完成身份验证。

> ⚠️ **注意事项**
>
> 1. 不得在客户端嵌入或暴露 AK/SK。
> 2. 推荐使用配置中心或环境变量存储密钥。
> 3. 配置合理的最小权限访问策略。

#### 1. 在代码中配置（⚠️ 不建议明文传入）

```typescript
import { ECSClient } from "@volcengine/ecs";

const client = new ECSClient({
  accessKeyId: "YOUR_AK",
  secretAccessKey: "YOUR_SK",
  region: "cn-beijing",
});
```

#### 2. 使用环境变量（推荐）

SDK 会自动读取以下环境变量：

- **Access Key ID**: `VOLCENGINE_ACCESS_KEY`
- **Secret Access Key**: `VOLCENGINE_SECRET_KEY`

```bash
export VOLCENGINE_ACCESS_KEY="YOUR_AK"
export VOLCENGINE_SECRET_KEY="YOUR_SK"
```

```typescript
const client = new ECSClient({ region: "cn-beijing" });
```

### STS Token 设置

STS（Security Token Service）是火山引擎提供的临时访问凭证机制。开发者通过服务端调用 STS 接口获取临时凭证（临时 AK、SK 和 Token），有效期可配置，适用于安全要求较高的场景。

> ⚠️ **注意事项**
>
> 1. 最小权限：仅授予调用方访问所需资源的最小权限，避免使用 \* 通配符授予全资源、全操作权限。
> 2. 设置合理的有效期：请根据实际情况设置合理有效期，越短越安全，建议不要超过 1 小时。

```typescript
const client = new ECSClient({
  accessKeyId: "YOUR_TEMP_AK",
  secretAccessKey: "YOUR_TEMP_SK",
  sessionToken: "YOUR_SESSION_TOKEN",
  region: "cn-beijing",
});

// 或通过环境变量设置：
// export VOLCENGINE_SESSION_TOKEN="YOUR_SESSION_TOKEN"
```

### STS AssumeRole 示例

STS AssumeRole 是火山引擎提供的临时访问凭证机制。使用 IAM 子账号角色进行 AssumeRole 操作后，获取临时凭证发起 API 请求。

参考文档：https://www.volcengine.com/docs/6257/86374

> ⚠️ **注意事项**
>
> 1. 最小权限：仅授予调用方访问所需资源的最小权限。
> 2. 设置合理的有效期：越短越安全，建议不要超过 1 小时。

```typescript
import { StsAssumeRoleProvider } from "@volcengine/sdk-core";
import { ECSClient } from "@volcengine/ecs";

const credentialProvider = new StsAssumeRoleProvider({
  accessKeyId: "ASSUME_ROLE_CALLER_AK",
  secretAccessKey: "ASSUME_ROLE_CALLER_SK",
  roleTrn: "trn:iam::2110400000:role/role123",
  region: "cn-beijing",
  host: "sts.volcengineapi.com",
  protocol: "https",
  durationSeconds: 3600,
  policy:
    '{"Statement":[{"Effect":"Allow","Action":["iam:ListUsers"],"Resource":["*"]}]}',
  tags: [{ Key: "project", Value: "sdk-test" }],
});

const client = new ECSClient({
  region: "cn-beijing",
  credentialProvider,
});
```

### STS AssumeRoleWithOIDC 示例

`OidcCredentialProvider` 通过 STS `AssumeRoleWithOIDC` 接口获取临时凭证，适用于已接入 OIDC 身份提供者的场景。使用 OIDC Token 进行 AssumeRoleWithOIDC 操作后，获取临时凭证发起 API 请求。

参考文档：https://www.volcengine.com/docs/6257/1494877

> ⚠️ **注意事项**
>
> 1. 最小权限：仅授予调用方访问所需资源的最小权限，避免使用 \* 通配符授予全资源、全操作权限。
> 2. 设置合理的有效期：越短越安全，建议不要超过 1 小时。

支持的环境变量：

| 环境变量                            | 说明                    | 必填 |
| ----------------------------------- | ----------------------- | :--: |
| `VOLCENGINE_OIDC_ROLE_TRN`          | 要扮演的角色 TRN        |  ✅  |
| `VOLCENGINE_OIDC_TOKEN_FILE`        | OIDC Token 文件路径     |  ✅  |
| `VOLCENGINE_OIDC_ROLE_SESSION_NAME` | 角色会话名称            |  ❌  |
| `VOLCENGINE_OIDC_ROLE_POLICY`       | 会话策略（JSON 字符串） |  ❌  |
| `VOLCENGINE_OIDC_STS_ENDPOINT`      | 自定义 STS Endpoint     |  ❌  |

```typescript
import { OidcCredentialProvider } from "@volcengine/sdk-core";
import { ECSClient } from "@volcengine/ecs";

// 显式传参（全部参数）
const credentialProvider = new OidcCredentialProvider({
  roleTrn: "trn:iam::2110400000:role/oidc-role",
  oidcTokenFile: "/path/to/oidc/token",
  roleSessionName: "my-session",
  host: "sts.volcengineapi.com",
  policy:
    '{"Statement":[{"Effect":"Allow","Action":["ecs:Describe*"],"Resource":["*"]}]}',
});

// 或从环境变量自动读取（无参构造）
const credentialProvider2 = new OidcCredentialProvider();

const client = new ECSClient({
  region: "cn-beijing",
  credentialProvider,
});
```

### STS AssumeRoleWithSAML 示例

`SamlCredentialProvider` 通过 STS `AssumeRoleWithSAML` 接口获取临时凭证，适用于 SAML 联邦身份场景。使用 SAML 断言进行 AssumeRoleWithSAML 操作后，获取临时凭证发起 API 请求。

参考文档：https://www.volcengine.com/docs/6257/1631607

> ⚠️ **注意事项**
>
> 1. 最小权限：仅授予调用方访问所需资源的最小权限，避免使用 \* 通配符授予全资源、全操作权限。
> 2. 设置合理的有效期：越短越安全，建议不要超过 1 小时。

支持的环境变量：

| 环境变量                       | 说明                     | 必填 |
| ------------------------------ | ------------------------ | :--: |
| `VOLCENGINE_SAML_ROLE_TRN`     | 要扮演的角色 TRN         |  ✅  |
| `VOLCENGINE_SAML_ACCOUNT_ID`   | 火山引擎账号 ID          |  ✅  |
| `VOLCENGINE_SAML_PROVIDER_TRN` | SAML 身份提供者 TRN      |  ✅  |
| `VOLCENGINE_SAML_ASSERTION`    | SAML 断言（Base64 编码） |  ✅  |
| `VOLCENGINE_SAML_ENDPOINT`     | 自定义 STS Endpoint      |  ❌  |
| `VOLCENGINE_SAML_POLICY`       | 会话策略（JSON 字符串）  |  ❌  |

```typescript
import { SamlCredentialProvider } from "@volcengine/sdk-core";
import { ECSClient } from "@volcengine/ecs";

// 显式传参（全部参数）
const credentialProvider = new SamlCredentialProvider({
  roleTrn: "trn:iam::2110400000:role/saml-role",
  accountId: "2110400000",
  samlProviderTrn: "trn:iam::2110400000:saml-provider/my-provider",
  samlAssertion: "BASE64_ENCODED_SAML_ASSERTION",
  host: "sts.volcengineapi.com",
  policy:
    '{"Statement":[{"Effect":"Allow","Action":["ecs:Describe*"],"Resource":["*"]}]}',
});

// 或从环境变量自动读取（无参构造）
const credentialProvider2 = new SamlCredentialProvider();

const client = new ECSClient({
  region: "cn-beijing",
  credentialProvider,
});
```

### 环境变量凭证 Provider

`EnvironmentVariableCredentialProvider` 读取以下环境变量：

- `VOLCSTACK_ACCESS_KEY_ID` / `VOLCSTACK_ACCESS_KEY`
- `VOLCSTACK_SECRET_ACCESS_KEY` / `VOLCSTACK_SECRET_KEY`
- `VOLCSTACK_SESSION_TOKEN`（可选）

```typescript
import { ECSClient } from "@volcengine/ecs";
import { EnvironmentVariableCredentialProvider } from "@volcengine/sdk-core";

const credentialProvider = new EnvironmentVariableCredentialProvider();
const client = new ECSClient({
  region: "cn-beijing",
  credentialProvider,
});
```

### CLI 配置凭证 Provider

`CLIConfigCredentialProvider` 默认读取 `~/.volcengine/config.json`。

- 配置文件优先级：`VOLCENGINE_CLI_CONFIG_FILE` 环境变量 > 默认路径 `~/.volcengine/config.json`

```typescript
import { ECSClient } from "@volcengine/ecs";
import { CLIConfigCredentialProvider } from "@volcengine/sdk-core";

const credentialProvider = new CLIConfigCredentialProvider();
const client = new ECSClient({
  region: "cn-beijing",
  credentialProvider,
});
```

### ECS Role 凭证 Provider

> 🚨 **当前版本限制**
>
> **当前版本暂不支持从 IMDS 自动探测角色名**，必须通过构造参数或 `VOLCENGINE_ECS_METADATA` 环境变量显式传入角色名。后续版本将支持自动探测，敬请关注版本发布通知。

`EcsRoleCredentialProvider` 从 ECS 实例元数据服务（IMDSv2）获取临时凭证：

- `roleName` 优先级：构造参数 > `VOLCENGINE_ECS_METADATA`
- 禁用开关：`VOLCENGINE_ECS_METADATA_DISABLED=true`
- IMDS 端点：`http://100.96.0.96`（IMDSv2 基于 token 的认证）
- 凭证在过期前自动刷新（默认 5 分钟缓冲窗口）

> ⚠️ **注意事项**
>
> 1. 仅在绑定了 IAM 角色的 ECS 实例上可用。
> 2. 使用前请显式传入 `roleName`，或设置 `VOLCENGINE_ECS_METADATA`。

| 环境变量                           | 说明                                                  |
| ---------------------------------- | ----------------------------------------------------- |
| `VOLCENGINE_ECS_METADATA`          | 指定 ECS 实例角色名（必须设置，除非通过构造参数传入） |
| `VOLCENGINE_ECS_METADATA_DISABLED` | 设为 `true` 禁用 IMDS 凭证获取                        |

```typescript
import { EcsRoleCredentialProvider } from "@volcengine/sdk-core";
import { ECSClient } from "@volcengine/ecs";

// 显式指定角色名
const credentialProvider = new EcsRoleCredentialProvider({
  roleName: "your-ecs-role-name",
});

const client = new ECSClient({
  region: "cn-beijing",
  credentialProvider,
});
```

### DefaultCredentialProvider（默认凭证链）

`DefaultCredentialProvider` 会按以下顺序尝试获取凭证，返回第一个成功的结果：

1. **EnvironmentVariableCredentialProvider** — 从环境变量读取
2. **OidcCredentialProvider** — 通过 OIDC 获取临时凭证
3. **CLIConfigCredentialProvider** — 从 CLI 配置文件读取
4. **EcsRoleCredentialProvider** — 通过 ECS IMDS 获取临时凭证（`VOLCENGINE_ECS_METADATA_DISABLED=true` 时跳过）

```typescript
import { ECSClient } from "@volcengine/ecs";
import { DefaultCredentialProvider } from "@volcengine/sdk-core";

// 基本用法
const credentialProvider = new DefaultCredentialProvider();

const client = new ECSClient({
  region: "cn-beijing",
  credentialProvider,
});
```

使用 `DefaultCredentialProvider` 后，SDK 会自动遍历凭证链，无需手动指定 AK/SK。

---

[← 概览](0-Overview-zh.md) | 访问凭据 [(English)](1-Credentials.md) | [Endpoint 配置 →](2-Endpoint-zh.md)
