[← Credentials](1-Credentials.md) | Endpoint Configuration [(中文)](2-Endpoint-zh.md) | [Transport →](3-Transport.md)

---

## Endpoint Configuration

> **Default**
>
> When no Endpoint is specified, [Automatic Endpoint Addressing](#automatic-endpoint-addressing) is used.

### Custom Endpoint

By directly specifying `host` in the client configuration, you can force the SDK to send all requests to that address. This is the highest priority configuration.

```typescript
const client = new ECSClient({
  host: "open.volcengineapi.com",
  region: "cn-beijing",
});
```

### Custom RegionId

```typescript
const client = new ECSClient({
  region: "cn-beijing",
});
```

### Automatic Endpoint Addressing

> **Default**
>
> Automatic addressing is supported by default, no need to manually specify Endpoint.

The SDK automatically constructs a reasonable access address based on service name, region, and other information, and supports DualStack.

#### Default Endpoint Addressing

##### Addressing Logic

1. **Whether to auto-address Region**
   The SDK only performs auto-addressing for regions in the built-in bootstrap region list; other regions return `open.volcengineapi.com` by default.

   Built-in bootstrap region list (source: [packages/sdk-core/src/utils/endpoint.ts](../packages/sdk-core/src/utils/endpoint.ts#L154-L160)):

   - `cn-beijing-autodriving`
   - `ap-southeast-2`
   - `ap-southeast-3`
   - `cn-shanghai-autodriving`
   - `cn-beijing-selfdrive`

   Extend via `VOLC_BOOTSTRAP_REGION_LIST_CONF` env var (file path) or `customBootstrapRegion` (Record<string, any>) in code.

2. **DualStack Support (IPv6)**
   Enable via `useDualStack: true` or `VOLC_ENABLE_DUALSTACK` env var. Priority: `useDualStack` > `VOLC_ENABLE_DUALSTACK`.
   When enabled, the domain suffix switches from `volcengineapi.com` to `volcengine-api.com`.

3. **Auto-construct Endpoint address**

   - **Global Services (e.g., CDN, IAM)**: `<ServiceName>.volcengineapi.com`
   - **Regional Services (e.g., ECS, RDS)**: `<ServiceName>.<RegionName>.volcengineapi.com`
   - **Unregistered Services**: If the service is not in the SDK's built-in service list, `open.volcengineapi.com` is returned even if the region is in the bootstrap list

   > Service names are standardized when constructing the domain: uppercase → lowercase, underscore `_` → hyphen `-`. For example, `rds_mysql` → `rds-mysql.cn-beijing.volcengineapi.com`

##### Code Example

```typescript
import { ECSClient } from "@volcengine/ecs";

// SDK auto-resolves Endpoint for bootstrap regions to: ecs.cn-beijing-autodriving.volcengineapi.com
const client = new ECSClient({
  region: "cn-beijing-autodriving",
});
```

#### DualStack Support

```typescript
const client = new ECSClient({
  region: "cn-beijing-autodriving",
  useDualStack: true,
});
// Generated Endpoint: ecs.cn-beijing-autodriving.volcengine-api.com
```

#### Non-Bootstrap Regions

If the `region` is not in the SDK's bootstrap region list, the SDK defaults to `open.volcengineapi.com`.
For example, with the default configuration, `cn-beijing` is not in the built-in bootstrap region list, so ECS auto endpoint resolution falls back to `open.volcengineapi.com`. To generate `ecs.cn-beijing.volcengineapi.com`, add `cn-beijing` to the bootstrap region list via `customBootstrapRegion` or `VOLC_BOOTSTRAP_REGION_LIST_CONF`.

### Custom Bootstrap Region List

Extend via `VOLC_BOOTSTRAP_REGION_LIST_CONF` env var pointing to a file (one region per line), or via `customBootstrapRegion` parameter:

```typescript
import { ECSClient } from "@volcengine/ecs";

const client = new ECSClient({
  region: "my-private-region",
  customBootstrapRegion: {
    "my-private-region": {},
  },
});
// Generated Endpoint: ecs.my-private-region.volcengineapi.com
```

### Standard Endpoint Addressing

| Global Service | DualStack | Format                                  |
| -------------- | --------- | --------------------------------------- |
| Yes            | Yes       | `{Service}.volcengine-api.com`          |
| Yes            | No        | `{Service}.volcengineapi.com`           |
| No             | Yes       | `{Service}.{region}.volcengine-api.com` |
| No             | No        | `{Service}.{region}.volcengineapi.com`  |

---

[← Credentials](1-Credentials.md) | Endpoint Configuration [(中文)](2-Endpoint-zh.md) | [Transport →](3-Transport.md)
