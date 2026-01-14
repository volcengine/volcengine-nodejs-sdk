中文 | [English](SDK_Integration.md)

## 目录

- [环境与安装](#环境与安装)
  - [环境要求](#环境要求)
  - [安装](#安装)
- [快速开始](#快速开始)
- [访问凭据](#访问凭据)
  - [AK/SK (访问密钥)](#aksk-访问密钥)
  - [STS Token (临时凭证)](#sts-token-临时凭证)
  - [STS AssumeRole (角色扮演)](#sts-assumerole-角色扮演)
- [Endpoint 配置](#endpoint-配置)
  - [自定义 Endpoint](#自定义-endpoint)
  - [自定义区域 (Region)](#自定义区域-region)
  - [自动化 Endpoint 寻址](#自动化-endpoint-寻址)
  - [Endpoint 默认寻址](#endpoint-默认寻址)
  - [自定义引导区域列表](#自定义引导区域列表)
  - [Endpoint 标准寻址](#endpoint-标准寻址)
- [网络配置](#网络配置)
  - [协议 Scheme](#协议-scheme)
  - [Http(s) 代理](#https-代理)
  - [忽略 SSL 验证](#忽略-ssl-验证)
- [超时配置](#超时配置)
  - [客户端级别超时](#客户端级别超时)
  - [请求级别超时](#请求级别超时)
- [重试机制](#重试机制)
  - [开启与配置重试](#开启与配置重试)
  - [退避策略](#退避策略)
  - [自定义重试策略](#自定义重试策略)
- [异常处理](#异常处理)
  - [输出原始文件](#输出原始文件)
  - [资源清理](#资源清理)
- [Debug 机制](#debug-机制)
- [环境变量说明](#环境变量说明)

## 环境与安装

### 环境要求

- Node.js >= 18

### 安装

推荐使用 `pnpm` 进行安装，同时支持 `npm` 和 `yarn`。

```bash
# pnpm
pnpm add @volcengine/sdk-core

# npm
npm install @volcengine/sdk-core

# yarn
yarn add @volcengine/sdk-core
```

## 访问凭据

SDK 支持多种方式配置访问凭据，优先级从高到低如下：

1.  **代码中显式配置** (`ClientConfig`)
2.  **环境变量**
3.  **配置文件** (`~/.volc/config`)

> **⚠️ 安全提示**
>
> 强烈建议不要将访问密钥（AK/SK）硬编码在代码中。推荐使用环境变量、角色扮演（AssumeRole）或外部配置中心来管理凭据。

### AK/SK (访问密钥)

#### 1. 在代码中配置（⚠️ 不建议明文传入）

在创建 `EcsClient` 实例时直接传入 `accessKeyId` 和 `secretAccessKey`。

```typescript
const client = new EcsClient({
  accessKeyId: "YOUR_AK",
  secretAccessKey: "YOUR_SK",
  region: "cn-beijing",
});
```

#### 2. 使用环境变量（推荐）

SDK 会自动读取以下环境变量：

- **Access Key ID**: `VOLCSTACK_ACCESS_KEY_ID` 或 `VOLCSTACK_ACCESS_KEY`
- **Secret Access Key**: `VOLCSTACK_SECRET_ACCESS_KEY` 或 `VOLCSTACK_SECRET_KEY`

配置环境变量后，无需在代码中再次配置凭据。

```bash
export VOLCSTACK_ACCESS_KEY_ID="YOUR_AK"
export VOLCSTACK_SECRET_ACCESS_KEY="YOUR_SK"
```

```typescript
// 无需传入 AK/SK
const client = new EcsClient({ region: "cn-beijing" });
```

#### 3. 使用配置文件（为兼容老版本 sdk，仅支持设置 AK，SK，其他变量均不支持）

当代码和环境变量均未提供凭据时，SDK 会尝试从 `~/.volc/config` 文件中读取。

```json
{
  "VOLC_ACCESSKEY": "YOUR_AK_FROM_FILE",
  "VOLC_SECRETKEY": "YOUR_SK_FROM_FILE"
}
```

### STS Token (临时凭证)

如果使用 STS 临时凭证，除了 AK/SK，还必须提供 `sessionToken`。

```typescript
// 方式一：代码配置（推荐使用环境变量）
const client = new EcsClient({
  accessKeyId: "YOUR_TEMP_AK",
  secretAccessKey: "YOUR_TEMP_SK",
  sessionToken: "YOUR_SESSION_TOKEN",
  region: "cn-beijing",
});

// 方式二：环境变量
// export VOLCSTACK_SESSION_TOKEN="YOUR_SESSION_TOKEN"
```

### STS AssumeRole (角色扮演)

STS AssumeRole（Security Token Service）是火山引擎提供的临时访问凭证机制。开发者通过服务端调用 STS 接口获取临时凭证（临时 AK、SK 和 Token），有效期可配置，适用于安全要求较高的场景。
此接口使用 IAM 子账号角色进行 AssumeRole 操作后，获取到 IAM 子用户的信息后，发起真正的 API 请求，参考如下
连接地址：https://www.volcengine.com/docs/6257/86374

> ⚠️ 注意事项
>
> 1. 最小权限： 仅授予调用方访问所需资源的最小权限，避免使用 \* 通配符授予全资源、全操作权限。
> 2. 设置合理的有效期: 请根据实际情况设置合理有效期，越短越安全，建议不要超过 1 小时。

在 `ClientConfig` 中配置 `assumeRoleParams` 来启用此功能：

```typescript
import { EcsClient } from "@volcengine/sdk-core";

const client = new EcsClient({
  region: "cn-beijing", // 业务请求的默认 Region

  // 配置角色扮演参数
  assumeRoleParams: {
    // 必填，子账号的 AK/SK
    accessKeyId: "ASSUME_ROLE_CALLER_AK",
    secretAccessKey: "ASSUME_ROLE_CALLER_SK",
    // # 必填，子账号的角色TRN，如trn:iam::2110400000:role/role123  ,此处填写role123
    roleName: "role123",
    // # 必填，子账号的角色TRN，如trn:iam::2110400000:role/role123  ,此处填写2110400000
    accountId: "2110400000",
    // STS 服务所在的 Region，通常是 "cn-beijing"
    region: "cn-beijing",
    // STS 服务的 Endpoint，默认为 "sts.volcengineapi.com"
    host: "sts.volcengineapi.com",
    // # 可选，协议 scheme，默认 https
    protocol: "https",
    // 期望的临时凭证有效期（秒），默认 3600
    durationSeconds: 3600,
    // (可选) 权限策略，进一步限制临时凭证的权限
    policy:
      '{"Statement":[{"Effect":"Allow","Action":["iam:ListUsers"],"Resource":["*"]}]}',
    // (可选) 为角色会话附加的标签
    tags: [{ Key: "project", Value: "sdk-test" }],
  },
});

// 使用此 client 发送的所有请求都将使用扮演角色后获取的临时凭据
// const result = await client.send(someCommand);
```

## Endpoint 配置

Endpoint（服务地址）决定了 API 请求发送到哪里。SDK 支持多种方式进行配置。

### 自定义 Endpoint

通过在客户端配置中直接指定 `host`，可以强制 SDK 将所有请求发送到该地址。这是最高优先级的配置。

```typescript
const client = new EcsClient({
  // ... 其他配置
  host: "open.volcengineapi.com", // 所有请求都将发往此域名
});
```

### 自定义 RegionId

Region 是大多数火山引擎服务的关键概念。你可以在客户端级别配置一个默认的 `region`。

```typescript
const client = new EcsClient({
  // ... 其他配置
  region: "cn-beijing", // 默认区域
});
```

### 自动化 Endpoint 寻址

> **默认**
>
> - 默认支持自动寻址，无需手动指定 Endpoint

为了简化用户配置，Vocoengine 提供了灵活的 Endpoint 自动寻址机制。用户无需手动指定服务地址，SDK 会根据服务名称、区域（Region）等信息自动拼接出合理的访问地址，并支持用户自定义 DualStack（双栈）支持。

#### Endpoint 默认寻址

**Endpoint 默认寻址逻辑**

1. 是否自动寻址 Region  
   内置自动寻址 Region 列表代码:[packages/sdk-core/src/utils/endpoint.ts#bootstrap_region](./packages/sdk-core/src/utils/endpoint.ts#L29)  
   SDK 仅对部分预设区域（如`cn-beijing-autodriving`、`ap-southeast-2`）或用户配置的区域执行自动寻址；其他区域默认返回 Endpoint：`open.volcengineapi.com`。  
   用户可通过环境变量 `VOLC_BOOTSTRAP_REGION_LIST_CONF` （配置文件地址）或代码中自定义 `customBootstrapRegion` (Record<string, any>) 来扩展控制区域列表。
2. DualStack 支持（IPv6）  
   SDK 支持双栈网络（IPv4 + IPv6）访问地址，自动启用条件如下：  
   显式传入参数`useDualStack`，或设置环境变量 `VOLC_ENABLE_DUALSTACK`，优先级`useDualStack`>`VOLC_ENABLE_DUALSTACK`  
   启用后，域名后缀将从 `volcengineapi.com` 切换为 `volcengine-api.com`。
3. 根据服务名和区域自动构造 Endpoint 地址，规则如下：  
   **全局服务（如 CDN、IAM）**  
   使用 `<服务名>.volcengineapi.com`（或启用双栈时使用 `volcengine-api.com`）。  
   示例：`cdn.volcengineapi.com`  
   **区域服务（如 ECS、RDS）**  
   使用 `<服务名>.<区域名>.volcengineapi.com` 作为默认 Endpoint。  
   示例：`ecs.cn-beijing.volcengineapi.com`

**代码示例**

```typescript
import { EcsClient } from "@volcengine/ecs";

// 示例：创建一个 ECS 客户端，未指定 Endpoint
// SDK 会根据 region 自动推导 Endpoint 为: ecs.cn-beijing.volcengineapi.com
const client = new EcsClient({
  region: "cn-beijing",
});
```

#### 双栈支持 (DualStack)

你可以通过 `useDualStack: true` 或设置环境变量 `VOLC_ENABLE_DUALSTACK=true` 来启用双栈网络，此时 Endpoint 的后缀会从 `volcengineapi.com` 变为 `volcengine-api.com`。

```typescript
const client = new EcsClient({
  // ... 其他配置
  region: "cn-beijing",
  useDualStack: true, // 定义是否启用双栈网络（IPv4 + IPv6）访问地址，默认false
});

// 对于 ECS 服务，生成的 Endpoint 将是 ecs.cn-beijing.volcengine-api.com
```

#### 非引导区域

如果请求的 `region` 不在 SDK 的引导区域列表中，SDK 将默认使用 `open.volcengineapi.com` 作为 Endpoint。

### 自定义引导区域列表

SDK 内部维护了一个引导区域列表。你可以通过环境变量 `VOLC_BOOTSTRAP_REGION_LIST_CONF` 指向一个文件路径，来扩展这个列表。该文件应包含一个或多个区域代码，每行一个。

```bash
# /path/to/my_regions.conf
us-east-1
eu-central-1
```

```bash
export VOLC_BOOTSTRAP_REGION_LIST_CONF=/path/to/my_regions.conf
```

或者，你也可以在创建 Client 时通过 `customBootstrapRegion` 参数直接指定：

```typescript
import { EcsClient } from "@volcengine/ecs";

// 示例： 自定义自动寻址Region列表
const client = new EcsClient({
  region: "my-private-region",
  customBootstrapRegion: {
    "my-private-region": {},
  },
});

// 此时生成的 Endpoint 将是: ecs.my-private-region.volcengineapi.com
// 如果不指定 customBootstrapRegion，默认会是: open.volcengineapi.com
```

### Endpoint 标准寻址

**标准寻址规则**

| Global 服务 | 双栈 | 格式                                    |
| ----------- | ---- | --------------------------------------- |
| 是          | 是   | `{Service}.volcengine-api.com`          |
| 是          | 否   | `{Service}.volcengineapi.com`           |
| 否          | 是   | `{Service}.{region}.volcengine-api.com` |
| 否          | 否   | `{Service}.{region}.volcengineapi.com`  |

## 网络配置

### 协议 Scheme

默认使用 `https` 协议。可以通过 `protocol` 字段修改为 `http`。

```typescript
const client = new EcsClient({
  // ... 其他配置
  protocol: "http",
});
```

### Http(s) 代理

SDK 支持通过客户端配置或环境变量来设置 HTTP/HTTPS 代理。

#### 1. 在代码中配置

在 `httpOptions` 中提供 `proxy` 对象。

```typescript
const client = new EcsClient({
  // ... 其他配置
  httpOptions: {
    proxy: {
      protocol: "http",
      host: "127.0.0.1",
      port: 8888,
    },
  },
});
```

#### 2. 使用环境变量

SDK 会自动读取以下环境变量来配置代理：

- `VOLC_PROXY_PROTOCOL`: 代理协议（`http` 或 `https`）
- `VOLC_PROXY_HOST`: 代理主机
- `VOLC_PROXY_PORT`: 代理端口

### 忽略 SSL 验证

在某些测试或特殊网络环境下，你可能需要忽略 SSL 证书验证。可以通过 `httpOptions.ignoreSSL` 实现。

> **⚠️ 警告**: 在生产环境中忽略 SSL 验证会带来严重的安全风险。请仅在确认安全的测试环境中使用。

```typescript
const client = new EcsClient({
  // ... 其他配置
  httpOptions: {
    ignoreSSL: true, // 忽略 SSL 证书验证
  },
});
```

### 连接池配置

SDK 支持自定义 HTTP 连接池配置，可以通过 `httpOptions.pool` 进行设置，例如配置 Keep-Alive、最大连接数等。

```typescript
const client = new EcsClient({
  // ... 其他配置
  httpOptions: {
    pool: {
      keepAlive: true, // 开启 Keep-Alive
      keepAliveMsecs: 1000, // Keep-Alive 延迟
      maxSockets: 50, // 最大连接数
      maxFreeSockets: 10, // 最大空闲连接数
    },
  },
});
```

## 超时配置

SDK 提供客户端和请求两个级别的超时配置，单位均为毫秒。

### 客户端级别超时

在创建客户端时通过 `httpOptions.timeout` 设置，这将成为所有请求的默认超时时间。默认值为 `30000` 毫秒（30 秒）。

```typescript
const client = new EcsClient({
  // ... 其他配置
  httpOptions: {
    timeout: 5000, // 默认超时时间为 5 秒
  },
});
```

### 请求级别超时

在调用 `send` 方法时，通过 `options.timeout` 为单个请求指定超时时间。此配置会覆盖客户端级别的设置。

```typescript
try {
  // 为这个特定的慢速请求设置 30 秒超时
  await client.send(slowCommand, { timeout: 30000 });
} catch (error) {
  // ...
}
```

## 重试机制

SDK 内置了强大的自动重试机制，用于处理网络错误和服务端临时性错误。

### 开启与配置重试

默认情况下，重试是开启的。每个请求最多会尝试 4 次（1 次初始尝试 + 3 次重试）。你可以通过 `autoRetry` 和 `maxRetries` 进行调整。

```typescript
const client = new EcsClient({
  // ... 其他配置

  // 完全禁用重试
  // autoRetry: false,

  // 自定义最大重试次数（不含首次尝试）
  maxRetries: 5, // 总共会尝试 6 次
});
```

SDK 只会对特定的错误进行重试，包括：

- 网络错误（如 `ECONNRESET`, `ETIMEDOUT` 等）
- HTTP 状态码为 `429`, `500`, `502`, `503`, `504` 的服务端错误

### 退避策略

退避策略决定了每次重试之间的等待时间。可以通过 `retryMode` 字段进行选择。

- `NoBackoffStrategy`: 不等待，立即重试。
- `ExponentialBackoffStrategy`: 指数退避。每次等待时间翻倍，例如 `300ms`, `600ms`, `1200ms`...
- `ExponentialWithRandomJitterBackoffStrategy` (默认): 带抖动的指数退避。在指数退避的基础上增加一个随机延迟，有助于避免“惊群效应”。

```typescript
const client = new EcsClient({
  // ... 其他配置
  retryMode: "ExponentialBackoffStrategy",
});
```

### 自定义重试策略

通过 `retryStrategy` 字段，你可以更精细地控制重试行为，例如自定义重试条件和延迟计算逻辑。

```typescript
const client = new EcsClient({
  // ... 其他配置
  retryStrategy: {
    // 最小重试延迟（默认 300ms）
    minRetryDelay: 500,
    // 最大重试延迟（默认 300000ms）
    maxRetryDelay: 20000,

    // 自定义重试条件
    retryIf: (error) => {
      // 除了默认的网络和 5xx 错误外，还重试特定的业务错误码
      if (error.data?.ResponseMetadata?.Error?.Code === "ResourceIsBusy") {
        return true;
      }
      // 可以调用 SDK 内置的 shouldRetry 函数来复用默认逻辑
      // return shouldRetry(error);
      return false; // 返回 false 表示不重试
    },

    // 自定义延迟计算逻辑
    delay: (attemptNumber) => {
      // 每次重试固定等待 1 秒
      return 1000;
    },
  },
});
```

## 异常处理

当请求失败时，SDK 会抛出 `HttpRequestError` 的实例。该错误对象包含丰富的调试信息。`HttpRequestError` 有三种 `name` 类型：

- `ApiException`: 表示收到了服务端的错误响应，例如参数错误、资源不存在等。
  - `status`: HTTP 状态码。
  - `data`: 服务端返回的完整错误信息体。
- `NetworkError`: 表示发生了网络层面的错误，例如 DNS 解析失败、连接超时等。此时没有 `status` 和 `data`。
- `Exception`: 其他未归类的异常。

```typescript
import { HttpRequestError } from "@volcengine/sdk-core";

try {
  await client.send(command);
} catch (error) {
  // 使用 instanceof 判断是否为 SDK 抛出的标准异常
  if (error instanceof HttpRequestError) {
    // 1. 如果存在 HTTP 状态码 (status)，通常表示服务端返回了错误或 SSL 握手失败
    if (error.status !== undefined) {
      // 1.1 SSL 错误 (status === 0)
      if (error.status === 0) {
        console.error(`❌ SSL Error: ${error.message}`);
      }
      // 1.2 服务端返回的错误 (status > 0)
      else {
        // 尝试读取服务端返回的详细错误信息 (ResponseMetadata)
        if (error.data?.ResponseMetadata?.Error) {
          const { Code, Message } = error.data.ResponseMetadata.Error;
          const { RequestId } = error.data.ResponseMetadata;
          console.error(`❌ API Error [${Code}]: ${Message}`);
          console.error(`   RequestId: ${RequestId}`);
        } else {
          // 其他 HTTP 错误 (如 404, 500, 502 等)
          console.error(`❌ HTTP Error ${error.status}: ${error.message}`);
        }
      }
    }
    // 2. 处理网络异常 (NetworkError)
    // 场景：超时、DNS 解析失败、无法连接等 (通常没有 status)
    else if (error.name === "NetworkError") {
      console.error("❌ Network Error Occurred:");
      console.error(`   Message: ${error.message}`);
      // 查看原始错误代码（如 ECONNREFUSED, ETIMEDOUT 等）
      if (error.originalError && (error.originalError as any).code) {
        console.error(`   Code:    ${(error.originalError as any).code}`);
      }
    }
    // 3. 处理其他 SDK 异常 (Exception)
    else {
      console.error("❌ SDK Exception Occurred:");
      console.error(`   Message: ${error.message}`);
      console.error(`   Name:    ${error.name}`);
      if (error.originalError) {
        console.error("   Cause:", error.originalError);
      }
    }
  }
  // 4. 未知错误 (非 SDK 抛出的错误)
  else {
    console.error("❌ Unknown Error:", error);
  }
}
```

### 资源清理

客户端可能持有网络连接等资源。在应用退出前，可以调用 `destroy` 方法来确保这些资源被正确释放。

```typescript
client.destroy();
```

## Debug 机制

为便于客户在处理请求时进行问题排查和调试，SDK 支持中间件日志功能，你可以通过注入自定义中间件来打印请求和响应的详细信息。

```typescript
import { EcsClient } from "@volcengine/ecs";

const client = new EcsClient({
  region: "cn-beijing",
  // ... 其他配置
});

// 添加日志中间件
client.middlewareStack.add(
  (next, context) => async (args) => {
    // 1. 请求前打印
    const { request } = args;
    console.log(
      "👉 [Request]:",
      request.method,
      request.protocol + "://" + request.host + request.pathname
    );
    // console.log("   Headers:", request.headers);
    // console.log("   Body:", request.body);

    // 2. 执行下一个中间件
    const result = await next(args);

    // 3. 响应后打印
    const { response } = result;
    if (response) {
      console.log("👈 [Response]:", response.status, response.statusText);
      // console.log("   Headers:", response.headers);
      // console.log("   Data:", response.data);
    }

    return result;
  },
  {
    step: "finalizeRequest", // 在发送请求的最后阶段执行
    name: "LogMiddleware", // 中间件名称
    priority: 10, // 优先级
  }
);
```

## 环境变量说明

SDK 支持通过环境变量来配置客户端行为。这些环境变量会在创建 Client 时自动读取，如果 Client 构造函数中提供了相同的配置，则以构造函数中的配置为准。

| 环境变量名                                             | 描述                          | 对应 ClientConfig 字段       | 默认值      |
| :----------------------------------------------------- | :---------------------------- | :--------------------------- | :---------- |
| `VOLCSTACK_ACCESS_KEY_ID` / `VOLCSTACK_ACCESS_KEY`     | 访问密钥 ID                   | `accessKeyId`                | -           |
| `VOLCSTACK_SECRET_ACCESS_KEY` / `VOLCSTACK_SECRET_KEY` | 访问密钥 Secret               | `secretAccessKey`            | -           |
| `VOLCSTACK_SESSION_TOKEN`                              | 临时访问令牌                  | `sessionToken`               | -           |
| `VOLC_ENABLE_DUALSTACK`                                | 是否启用双栈（IPv4+IPv6）支持 | `useDualStack`               | `false`     |
| `VOLC_BOOTSTRAP_REGION_LIST_CONF`                      | 自定义引导区域列表文件路径    | -                            | -           |
| `VOLC_PROXY_PROTOCOL`                                  | 代理协议 (`http` / `https`)   | `httpOptions.proxy.protocol` | `http`      |
| `VOLC_PROXY_HOST`                                      | 代理主机地址                  | `httpOptions.proxy.host`     | `127.0.0.1` |
| `VOLC_PROXY_PORT`                                      | 代理端口                      | `httpOptions.proxy.port`     | -           |
