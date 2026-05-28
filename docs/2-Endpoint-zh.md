[← 访问凭据](1-Credentials-zh.md) | Endpoint 配置 [(English)](2-Endpoint.md) | [Transport →](3-Transport-zh.md)

---

## Endpoint 配置

> **默认**
>
> 不指定 Endpoint 时，走 [自动化 Endpoint 寻址](#自动化-endpoint-寻址)。

### 自定义 Endpoint

通过在客户端配置中直接指定 `host`，可以强制 SDK 将所有请求发送到该地址。这是最高优先级的配置。

```typescript
const client = new EcsClient({
  host: "open.volcengineapi.com",
  region: "cn-beijing",
});
```

### 自定义 RegionId

Region 是大多数火山引擎服务的关键概念。你可以在客户端级别配置一个默认的 `region`。

```typescript
const client = new EcsClient({
  region: "cn-beijing",
});
```

### 自动化 Endpoint 寻址

> **默认**
>
> 默认支持自动寻址，无需手动指定 Endpoint。

为了简化用户配置，Volcengine 提供了灵活的 Endpoint 自动寻址机制。用户无需手动指定服务地址，SDK 会根据服务名称、区域（Region）等信息自动拼接出合理的访问地址，并支持 DualStack（双栈）。

#### Endpoint 默认寻址

##### 寻址逻辑

1. **是否自动寻址 Region**
   SDK 仅对内置引导区域列表中的区域执行自动寻址；其他区域默认返回 Endpoint：`open.volcengineapi.com`。

   内置引导区域列表（源码：[packages/sdk-core/src/utils/endpoint.ts](../packages/sdk-core/src/utils/endpoint.ts#L154-L160)）：

   - `cn-beijing-autodriving`
   - `ap-southeast-2`
   - `ap-southeast-3`
   - `cn-shanghai-autodriving`
   - `cn-beijing-selfdrive`

   用户可通过环境变量 `VOLC_BOOTSTRAP_REGION_LIST_CONF`（配置文件地址）或代码中自定义 `customBootstrapRegion`（Record<string, any>）来扩展引导区域列表。

2. **DualStack 支持（IPv6）**
   SDK 支持双栈网络（IPv4 + IPv6）访问地址，自动启用条件如下：
   显式传入参数 `useDualStack`，或设置环境变量 `VOLC_ENABLE_DUALSTACK`。优先级：`useDualStack` > `VOLC_ENABLE_DUALSTACK`。
   启用后，域名后缀将从 `volcengineapi.com` 切换为 `volcengine-api.com`。

3. **根据服务名和区域自动构造 Endpoint 地址**

   - **全局服务（如 CDN、IAM）**：使用 `<服务名>.volcengineapi.com`（或启用双栈时使用 `volcengine-api.com`）。示例：`cdn.volcengineapi.com`
   - **区域服务（如 ECS、RDS）**：使用 `<服务名>.<区域名>.volcengineapi.com`。示例：`ecs.cn-beijing.volcengineapi.com`
   - **未注册的服务**：如果服务未在 SDK 内置的服务列表中注册，即使区域在引导列表中，仍返回默认 Endpoint `open.volcengineapi.com`

   > 服务名在拼接域名时会进行标准化：大写转小写，下划线 `_` 转连字符 `-`。例如 `rds_mysql` → `rds-mysql.cn-beijing.volcengineapi.com`

##### 代码示例

```typescript
import { EcsClient } from "@volcengine/ecs";

// SDK 会根据 region 自动推导 Endpoint 为: ecs.cn-beijing.volcengineapi.com
const client = new EcsClient({
  region: "cn-beijing",
});
```

#### 双栈支持 (DualStack)

```typescript
const client = new EcsClient({
  region: "cn-beijing",
  useDualStack: true,
});
// 生成的 Endpoint: ecs.cn-beijing.volcengine-api.com
```

#### 非引导区域

如果请求的 `region` 不在 SDK 的引导区域列表中，SDK 将默认使用 `open.volcengineapi.com` 作为 Endpoint。

### 自定义引导区域列表

SDK 内部维护了一个引导区域列表。你可以通过环境变量 `VOLC_BOOTSTRAP_REGION_LIST_CONF` 指向一个文件路径来扩展这个列表，该文件每行一个区域代码。

```bash
# /path/to/my_regions.conf
us-east-1
eu-central-1
```

```bash
export VOLC_BOOTSTRAP_REGION_LIST_CONF=/path/to/my_regions.conf
```

或者在创建 Client 时通过 `customBootstrapRegion` 参数直接指定：

```typescript
import { EcsClient } from "@volcengine/ecs";

const client = new EcsClient({
  region: "my-private-region",
  customBootstrapRegion: {
    "my-private-region": {},
  },
});
// 生成的 Endpoint: ecs.my-private-region.volcengineapi.com
```

### Endpoint 标准寻址

| Global 服务 | 双栈 | 格式                                    |
| ----------- | ---- | --------------------------------------- |
| 是          | 是   | `{Service}.volcengine-api.com`          |
| 是          | 否   | `{Service}.volcengineapi.com`           |
| 否          | 是   | `{Service}.{region}.volcengine-api.com` |
| 否          | 否   | `{Service}.{region}.volcengineapi.com`  |

---

[← 访问凭据](1-Credentials-zh.md) | Endpoint 配置 [(English)](2-Endpoint.md) | [Transport →](3-Transport-zh.md)
