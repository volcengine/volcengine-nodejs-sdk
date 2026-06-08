[← 概览](0-Overview-zh.md) | 环境变量 [(English)](EnvironmentVariables.md)

---

## 环境变量

本页集中列出 SDK 支持的所有环境变量，便于部署/CI 环境注入。

### 设置方法

#### Linux / macOS

临时（当前 shell 生效）：

```shell
export VOLCENGINE_ACCESS_KEY=your-ak
export VOLCENGINE_SECRET_KEY=your-sk
# 可选
export VOLCENGINE_SESSION_TOKEN=your-session-token
```

持久化：将 `export` 写入 `~/.bashrc`、`~/.zshrc` 等 shell 启动文件。

校验：`echo $VOLCENGINE_ACCESS_KEY` 返回预期值即设置成功。

#### Windows

命令行（以管理员身份运行）：

```cmd
setx VOLCENGINE_ACCESS_KEY your-ak /M
setx VOLCENGINE_SECRET_KEY your-sk /M
setx VOLCENGINE_SESSION_TOKEN your-session-token /M
```

`/M` 表示系统级；省略 `/M` 为用户级变量。

---

### 凭据（Credentials）

#### 基础 AK/SK/Token

| 变量                       | 说明                       | 必填 |
| -------------------------- | -------------------------- | :--: |
| `VOLCENGINE_ACCESS_KEY`    | Access Key                 |  ✅  |
| `VOLCENGINE_SECRET_KEY`    | Secret Key                 |  ✅  |
| `VOLCENGINE_SESSION_TOKEN` | STS 临时凭证 Session Token |  ❌  |

#### OIDC（AssumeRoleWithOIDC）

| 变量                                | 说明                    | 必填 |
| ----------------------------------- | ----------------------- | :--: |
| `VOLCENGINE_OIDC_ROLE_TRN`          | 要扮演的角色 TRN        |  ✅  |
| `VOLCENGINE_OIDC_TOKEN_FILE`        | OIDC Token 文件路径     |  ✅  |
| `VOLCENGINE_OIDC_ROLE_SESSION_NAME` | 角色会话名称            |  ❌  |
| `VOLCENGINE_OIDC_STS_ENDPOINT`      | 自定义 STS Endpoint     |  ❌  |
| `VOLCENGINE_OIDC_ROLE_POLICY`       | 会话策略（JSON 字符串） |  ❌  |

#### SAML（AssumeRoleWithSAML）

| 变量                           | 说明                     | 必填 |
| ------------------------------ | ------------------------ | :--: |
| `VOLCENGINE_SAML_ROLE_TRN`     | 要扮演的角色 TRN         |  ✅  |
| `VOLCENGINE_SAML_ACCOUNT_ID`   | 火山引擎账号 ID          |  ✅  |
| `VOLCENGINE_SAML_PROVIDER_TRN` | SAML 身份提供者 TRN      |  ✅  |
| `VOLCENGINE_SAML_ASSERTION`    | SAML 断言（Base64 编码） |  ✅  |
| `VOLCENGINE_SAML_ENDPOINT`     | 自定义 STS Endpoint      |  ❌  |
| `VOLCENGINE_SAML_POLICY`       | 会话策略（JSON 字符串）  |  ❌  |

#### ECS 实例角色（IMDS）

| 变量                               | 说明                                          | 默认值 |
| ---------------------------------- | --------------------------------------------- | ------ |
| `VOLCENGINE_ECS_METADATA`          | 指定 ECS 实例角色名（必须设置，除非通过构造参数传入） | -      |
| `VOLCENGINE_ECS_METADATA_DISABLED` | 设为 `true` 禁用 IMDS 凭证获取                | -      |

#### CLI 配置文件

| 变量                         | 说明             | 默认值                      |
| ---------------------------- | ---------------- | --------------------------- |
| `VOLCENGINE_CLI_CONFIG_FILE` | CLI 配置文件路径 | `~/.volcengine/config.json` |

---

### Endpoint & 网络

| 变量                              | 说明                                          | 默认值  |
| --------------------------------- | --------------------------------------------- | ------- |
| `VOLC_ENABLE_DUALSTACK`           | 启用双栈（IPv4+IPv6），设为 `true` 启用       | `false` |
| `VOLC_BOOTSTRAP_REGION_LIST_CONF` | 自定义引导区域列表文件路径（每行一个 region） | -       |

---

### HTTP 代理

当 `VOLC_PROXY_HOST` 或 `VOLC_PROXY_PORT` 任一被设置时，SDK 自动启用代理。

| 变量                  | 说明                         | 默认值                       |
| --------------------- | ---------------------------- | ---------------------------- |
| `VOLC_PROXY_PROTOCOL` | 代理协议（`http` / `https`） | `http`                       |
| `VOLC_PROXY_HOST`     | 代理主机地址                 | `127.0.0.1`                  |
| `VOLC_PROXY_PORT`     | 代理端口                     | `80`（http）/ `443`（https） |

---

### 默认凭证链顺序

未显式配置凭证时，`DefaultCredentialProvider` 按以下顺序依次尝试，首个成功的 Provider 生效：

| 顺序 | Provider                              | 依赖的环境变量                                                                         |
| :--: | ------------------------------------- | -------------------------------------------------------------------------------------- |
|  1   | EnvironmentVariableCredentialProvider | `VOLCENGINE_ACCESS_KEY` / `VOLCSTACK_ACCESS_KEY_ID` / `VOLCSTACK_ACCESS_KEY` + 对应 SK |
|  2   | OidcCredentialProvider                | `VOLCENGINE_OIDC_ROLE_TRN` + `VOLCENGINE_OIDC_TOKEN_FILE`                              |
|  3   | CLIConfigCredentialProvider           | `VOLCENGINE_CLI_CONFIG_FILE`（可选）                                                   |
|  4   | EcsRoleCredentialProvider             | `VOLCENGINE_ECS_METADATA`（可选），`VOLCENGINE_ECS_METADATA_DISABLED=true` 时跳过      |

---

### 优先级总表

| 配置项            | 优先级（高 → 低）                                               |
| ----------------- | --------------------------------------------------------------- |
| AK/SK/Token       | `VOLCENGINE_*` > `VOLCSTACK_*_ID` > `VOLCSTACK_*`               |
| OIDC STS Endpoint | 构造参数 `host` > `VOLCENGINE_OIDC_STS_ENDPOINT`                |
| SAML STS Endpoint | 构造参数 `host` > `VOLCENGINE_SAML_ENDPOINT`                    |
| CLI 配置文件路径  | `VOLCENGINE_CLI_CONFIG_FILE` > `~/.volcengine/config.json`      |
| ECS Role 名称     | 构造参数 `roleName` > `VOLCENGINE_ECS_METADATA` > IMDS 自动探测 |
| 双栈              | 构造参数 `useDualStack` > `VOLC_ENABLE_DUALSTACK`               |
| 代理              | 构造参数 `httpOptions.proxy` > `VOLC_PROXY_*`                   |

---

### 历史兼容变量（`VOLCSTACK_*`）

早期 SDK 使用 `VOLCSTACK_*` 前缀。当同名 `VOLCENGINE_*` 变量未设置时，下列变量会作为 fallback 生效。**新代码请统一使用 `VOLCENGINE_*`。**

| 变量                                                   | 等价的 `VOLCENGINE_*`      | Node.js | Go  | Python |
| ------------------------------------------------------ | -------------------------- | :-----: | :-: | :----: |
| `VOLCSTACK_ACCESS_KEY_ID` / `VOLCSTACK_ACCESS_KEY`     | `VOLCENGINE_ACCESS_KEY`    |   ✅    | ✅  |   ❌   |
| `VOLCSTACK_SECRET_ACCESS_KEY` / `VOLCSTACK_SECRET_KEY` | `VOLCENGINE_SECRET_KEY`    |   ✅    | ✅  |   ❌   |
| `VOLCSTACK_SESSION_TOKEN`                              | `VOLCENGINE_SESSION_TOKEN` |   ✅    | ✅  |   ❌   |

Fallback 优先级：`VOLCENGINE_*` > `VOLCSTACK_*_ID` > `VOLCSTACK_*`

---

### 相关文档

- [访问凭据](1-Credentials-zh.md) — 各 Provider 的代码级用法
- [Endpoint 配置](2-Endpoint-zh.md) — 双栈、引导区域列表详细说明
- [代理配置](4-Proxy-zh.md) — 代理配置的代码级用法

---

[← 概览](0-Overview-zh.md) | 环境变量 [(English)](EnvironmentVariables.md)
