English | [中文](SDK_Integration_zh.md)

## Table of Contents

- [Environment and Installation](#environment-and-installation)
  - [Environment Requirements](#environment-requirements)
  - [Installation](#installation)
- [Quick Start](#quick-start)
- [Credentials](#credentials)
  - [AK/SK (Access Key)](#aksk-access-key)
  - [STS Token (Security Token Service)](#sts-token-security-token-service)
  - [STS AssumeRole](#sts-assumerole)
- [Endpoint Configuration](#endpoint-configuration)
  - [Custom Endpoint](#custom-endpoint)
  - [Custom Region](#custom-region)
  - [Automatic Endpoint Addressing](#automatic-endpoint-addressing)
  - [Default Endpoint Addressing](#default-endpoint-addressing)
  - [Custom Bootstrap Region List](#custom-bootstrap-region-list)
  - [Standard Endpoint Addressing](#standard-endpoint-addressing)
- [Network Configuration](#network-configuration)
  - [Protocol Scheme](#protocol-scheme)
  - [Http(s) Proxy](#https-proxy)
  - [Ignore SSL Verification](#ignore-ssl-verification)
- [Timeout Configuration](#timeout-configuration)
  - [Client Level Timeout](#client-level-timeout)
  - [Request Level Timeout](#request-level-timeout)
- [Retry Mechanism](#retry-mechanism)
  - [Enable and Configure Retry](#enable-and-configure-retry)
  - [Backoff Strategy](#backoff-strategy)
  - [Custom Retry Strategy](#custom-retry-strategy)
- [Exception Handling](#exception-handling)
  - [Output Raw Response](#output-raw-response)
  - [Resource Cleanup](#resource-cleanup)
- [Debug Mechanism](#debug-mechanism)
- [Environment Variables Description](#environment-variables-description)

## Environment and Installation

### Environment Requirements

- Node.js >= 18

### Installation

It is recommended to use `pnpm` for installation, but `npm` and `yarn` are also supported.

```bash
# pnpm
pnpm add @volcengine/sdk-core

# npm
npm install @volcengine/sdk-core

# yarn
yarn add @volcengine/sdk-core
```

## Credentials

The SDK supports multiple ways to configure credentials, with the following priority from high to low:

1.  **Explicit configuration in code** (`ClientConfig`)
2.  **Environment Variables**
3.  **Configuration File** (`~/.volc/config`)

> **⚠️ Security Warning**
>
> It is strongly recommended not to hardcode access keys (AK/SK) in your code. It is recommended to use environment variables, AssumeRole, or an external configuration center to manage credentials.

### AK/SK (Access Key)

#### 1. Configure in Code (⚠️ Not Recommended to pass in plain text)

Pass `accessKeyId` and `secretAccessKey` directly when creating an `EcsClient` instance.

```typescript
const client = new EcsClient({
  accessKeyId: "YOUR_AK",
  secretAccessKey: "YOUR_SK",
  region: "cn-beijing",
});
```

#### 2. Use Environment Variables （Recommended）

The SDK automatically reads the following environment variables:

- **Access Key ID**: `VOLCSTACK_ACCESS_KEY_ID` or `VOLCSTACK_ACCESS_KEY`
- **Secret Access Key**: `VOLCSTACK_SECRET_ACCESS_KEY` or `VOLCSTACK_SECRET_KEY`

After configuring environment variables, there is no need to configure credentials again in the code.

```bash
export VOLCSTACK_ACCESS_KEY_ID="YOUR_AK"
export VOLCSTACK_SECRET_ACCESS_KEY="YOUR_SK"
```

```typescript
// No need to pass AK/SK
const client = new EcsClient({ region: "cn-beijing" });
```

#### 3. Use Configuration File (Only supports AK, SK; other variables are not supported)

When neither code nor environment variables provide credentials, the SDK will attempt to read from the `~/.volc/config` file.

```json
{
  "VOLC_ACCESSKEY": "YOUR_AK_FROM_FILE",
  "VOLC_SECRETKEY": "YOUR_SK_FROM_FILE"
}
```

### STS Token (Security Token Service)

If using STS temporary credentials, in addition to AK/SK, you must also provide `sessionToken`.

```typescript
// Method 1: Code configuration (Environment variables are recommended)
const client = new EcsClient({
  accessKeyId: "YOUR_TEMP_AK",
  secretAccessKey: "YOUR_TEMP_SK",
  sessionToken: "YOUR_SESSION_TOKEN",
  region: "cn-beijing",
});

// Method 2: Environment Variables
// export VOLCSTACK_SESSION_TOKEN="YOUR_SESSION_TOKEN"
```

### STS AssumeRole

STS AssumeRole (Security Token Service) is a temporary access credential mechanism provided by Volcengine. Developers obtain temporary credentials (temporary AK, SK, and Token) by calling the STS interface on the server side. The validity period is configurable, making it suitable for scenarios with high security requirements.
This interface uses an IAM sub-account role to perform the AssumeRole operation. After obtaining the IAM sub-user information, the actual API request is initiated. Reference follows:
Link: https://www.volcengine.com/docs/6257/86374

> ⚠️ Precautions
>
> 1. Least Privilege: Grant only the minimum permissions required for the caller to access the necessary resources, avoiding the use of \* wildcards to grant full resource and full operation permissions.
> 2. Set Reasonable Validity Period: Please set a reasonable validity period based on the actual situation. Shorter is safer; it is recommended not to exceed 1 hour.

Configure `assumeRoleParams` in `ClientConfig` to enable this feature:

```typescript
import { EcsClient } from "@volcengine/sdk-core";

const client = new EcsClient({
  region: "cn-beijing", // Default Region for business requests

  // Configure role assumption parameters
  assumeRoleParams: {
    // Required, sub-account AK/SK
    accessKeyId: "ASSUME_ROLE_CALLER_AK",
    secretAccessKey: "ASSUME_ROLE_CALLER_SK",
    // # Required, sub-account role TRN, e.g., trn:iam::2110400000:role/role123, fill in role123 here
    roleName: "role123",
    // # Required, sub-account role TRN, e.g., trn:iam::2110400000:role/role123, fill in 2110400000 here
    accountId: "2110400000",
    // Region where STS service is located, usually "cn-beijing"
    region: "cn-beijing",
    // Endpoint of STS service, defaults to "sts.volcengineapi.com"
    host: "sts.volcengineapi.com",
    // # Optional, protocol scheme, default https
    protocol: "https",
    // Expected temporary credential validity period (seconds), default 3600
    durationSeconds: 3600,
    // (Optional) Permission policy to further limit the permissions of temporary credentials
    policy:
      '{"Statement":[{"Effect":"Allow","Action":["iam:ListUsers"],"Resource":["*"]}]}',
    // (Optional) Tags attached to the role session
    tags: [{ Key: "project", Value: "sdk-test" }],
  },
});

// All requests sent using this client will use the temporary credentials obtained after assuming the role
// const result = await client.send(someCommand);
```

## Endpoint Configuration

The Endpoint (service address) determines where API requests are sent. The SDK supports multiple ways to configure it.

### Custom Endpoint

By directly specifying `host` in the client configuration, you can force the SDK to send all requests to that address. This is the highest priority configuration.

```typescript
const client = new EcsClient({
  // ... other configurations
  host: "open.volcengineapi.com", // All requests will be sent to this domain
});
```

### Custom RegionId

Region is a key concept for most Volcengine services. You can configure a default `region` at the client level.

```typescript
const client = new EcsClient({
  // ... other configurations
  region: "cn-beijing", // Default region
});
```

### Automatic Endpoint Addressing

> **Default**
>
> - Automatic addressing is supported by default, no need to manually specify Endpoint.

To simplify user configuration, Volcengine provides a flexible Endpoint automatic addressing mechanism. Users do not need to manually specify the service address; the SDK will automatically construct a reasonable access address based on service name, region (Region), and other information, and supports user-defined DualStack support.

### Default Endpoint Addressing

**Default Endpoint Addressing Logic**

1. Whether to automatically address Region
   Built-in automatic addressing Region list code: [packages/sdk-core/src/utils/endpoint.ts#bootstrap_region](./packages/sdk-core/src/utils/endpoint.ts#L29)
   The SDK only performs automatic addressing for some preset regions (such as `cn-beijing-autodriving`, `ap-southeast-2`) or user-configured regions; other regions return Endpoint: `open.volcengineapi.com` by default.
   Users can extend the control region list via the environment variable `VOLC_BOOTSTRAP_REGION_LIST_CONF` (configuration file address) or by customizing `customBootstrapRegion` (Record<string, any>) in the code.
2. DualStack Support (IPv6)
   The SDK supports dual-stack network (IPv4 + IPv6) access addresses. The automatic enabling conditions are as follows:
   Explicitly pass the parameter `useDualStack`, or set the environment variable `VOLC_ENABLE_DUALSTACK`. Priority `useDualStack` > `VOLC_ENABLE_DUALSTACK`.
   After enabling, the domain suffix will switch from `volcengineapi.com` to `volcengine-api.com`.
3. Automatically construct Endpoint address based on service name and region, rules are as follows:
   **Global Services (e.g., CDN, IAM)**
   Use `<ServiceName>.volcengineapi.com` (or `volcengine-api.com` when dual-stack is enabled).
   Example: `cdn.volcengineapi.com`
   **Regional Services (e.g., ECS, RDS)**
   Use `<ServiceName>.<RegionName>.volcengineapi.com` as the default Endpoint.
   Example: `ecs.cn-beijing.volcengineapi.com`

#### Code Example

```typescript
import { EcsClient } from "@volcengine/ecs";

// Example: Create an ECS client without specifying Endpoint
// SDK will automatically deduce Endpoint based on region as: ecs.cn-beijing.volcengineapi.com
const client = new EcsClient({
  region: "cn-beijing",
});
```

#### DualStack Support (DualStack)

You can enable dual-stack networking by `useDualStack: true` or setting the environment variable `VOLC_ENABLE_DUALSTACK=true`. In this case, the Endpoint suffix will change from `volcengineapi.com` to `volcengine-api.com`.

```typescript
const client = new EcsClient({
  // ... other configurations
  region: "cn-beijing",
  useDualStack: true, // Define whether to enable dual-stack network (IPv4 + IPv6) access address, default false
});

// For ECS service, the generated Endpoint will be ecs.cn-beijing.volcengine-api.com
```

#### Non-Bootstrap Regions

If the requested `region` is not in the SDK's bootstrap region list, the SDK will default to using `open.volcengineapi.com` as the Endpoint.

### Custom Bootstrap Region List

The SDK maintains a bootstrap region list internally. You can extend this list by pointing the environment variable `VOLC_BOOTSTRAP_REGION_LIST_CONF` to a file path. The file should contain one or more region codes, one per line.

```bash
# /path/to/my_regions.conf
us-east-1
eu-central-1
```

```bash
export VOLC_BOOTSTRAP_REGION_LIST_CONF=/path/to/my_regions.conf
```

Alternatively, you can specify it directly via the `customBootstrapRegion` parameter when creating the Client:

```typescript
import { EcsClient } from "@volcengine/ecs";

// Example: Custom automatic addressing Region list
const client = new EcsClient({
  region: "my-private-region",
  customBootstrapRegion: {
    "my-private-region": {},
  },
});

// The generated Endpoint will be: ecs.my-private-region.volcengineapi.com
// If customBootstrapRegion is not specified, it will default to: open.volcengineapi.com
```

### Standard Endpoint Addressing

**Standard Addressing Rules**

| Global Service | DualStack | Format                                  |
| -------------- | --------- | --------------------------------------- |
| Yes            | Yes       | `{Service}.volcengine-api.com`          |
| Yes            | No        | `{Service}.volcengineapi.com`           |
| No             | Yes       | `{Service}.{region}.volcengine-api.com` |
| No             | No        | `{Service}.{region}.volcengineapi.com`  |

## Network Configuration

### Protocol Scheme

The default protocol is `https`. You can change it to `http` via the `protocol` field.

```typescript
const client = new EcsClient({
  // ... other configurations
  protocol: "http",
});
```

### Http(s) Proxy

The SDK supports setting HTTP/HTTPS proxies via client configuration or environment variables.

#### 1. Configure in Code

Provide a `proxy` object in `httpOptions`.

```typescript
const client = new EcsClient({
  // ... other configurations
  httpOptions: {
    proxy: {
      protocol: "http",
      host: "127.0.0.1",
      port: 8888,
    },
  },
});
```

#### 2. Use Environment Variables

The SDK automatically reads the following environment variables to configure the proxy:

- `VOLC_PROXY_PROTOCOL`: Proxy protocol (`http` or `https`)
- `VOLC_PROXY_HOST`: Proxy host
- `VOLC_PROXY_PORT`: Proxy port

### Ignore SSL Verification

In some testing or special network environments, you may need to ignore SSL certificate verification. This can be achieved via `httpOptions.ignoreSSL`.

> **⚠️ Warning**: Ignoring SSL verification in a production environment poses serious security risks. Please use it only in confirmed safe testing environments.

```typescript
const client = new EcsClient({
  // ... other configurations
  httpOptions: {
    ignoreSSL: true, // Ignore SSL certificate verification
  },
});
```

### Connection Pool Configuration

The SDK supports custom HTTP connection pool configuration, which can be set via `httpOptions.pool`, such as configuring Keep-Alive, maximum number of connections, etc.

```typescript
const client = new EcsClient({
  // ... other configurations
  httpOptions: {
    pool: {
      keepAlive: true, // Enable Keep-Alive
      keepAliveMsecs: 1000, // Keep-Alive delay
      maxSockets: 50, // Maximum number of sockets
      maxFreeSockets: 10, // Maximum number of free sockets
    },
  },
});
```

## Timeout Configuration

The SDK provides timeout configurations at both the client and request levels, both in milliseconds.

### Client Level Timeout

Set via `httpOptions.timeout` when creating the client. This will become the default timeout for all requests. The default value is `30000` milliseconds (30 seconds).

```typescript
const client = new EcsClient({
  // ... other configurations
  httpOptions: {
    timeout: 5000, // Default timeout is 5 seconds
  },
});
```

### Request Level Timeout

When calling the `send` method, specify the timeout for a single request via `options.timeout`. This configuration overrides the client-level setting.

```typescript
try {
  // Set a 30-second timeout for this specific slow request
  await client.send(slowCommand, { timeout: 30000 });
} catch (error) {
  // ...
}
```

## Retry Mechanism

The SDK has a powerful built-in automatic retry mechanism to handle network errors and temporary server-side errors.

### Enable and Configure Retry

By default, retry is enabled. Each request will attempt at most 4 times (1 initial attempt + 3 retries). You can adjust this via `autoRetry` and `maxRetries`.

```typescript
const client = new EcsClient({
  // ... other configurations

  // Completely disable retry
  // autoRetry: false,

  // Custom maximum retry attempts (excluding the first attempt)
  maxRetries: 5, // Will attempt 6 times in total
});
```

The SDK only retries specific errors, including:

- Network errors (such as `ECONNRESET`, `ETIMEDOUT`, etc.)
- Server-side errors with HTTP status codes `429`, `500`, `502`, `503`, `504`

### Backoff Strategy

The backoff strategy determines the wait time between each retry. You can choose via the `retryMode` field.

- `NoBackoffStrategy`: Do not wait, retry immediately.
- `ExponentialBackoffStrategy`: Exponential backoff. Wait time doubles each time, e.g., `300ms`, `600ms`, `1200ms`...
- `ExponentialWithRandomJitterBackoffStrategy` (Default): Exponential backoff with jitter. Adds a random delay on top of exponential backoff to help avoid "thundering herd" effects.

```typescript
import { StrategyName } from "@volcengine/sdk-core";
const client = new EcsClient({
  // ... other configurations
  strategyName: StrategyName.ExponentialWithRandomJitterBackoffStrategy,
});
```

### Custom Retry Strategy

Through the `retryStrategy` field, you can control retry behavior more precisely, such as custom retry conditions and delay calculation logic.

```typescript
const client = new EcsClient({
  // ... other configurations
  retryStrategy: {
    // Minimum retry delay (default 300ms)
    minRetryDelay: 500,
    // Maximum retry delay (default 300000ms)
    maxRetryDelay: 20000,

    // Custom retry condition
    retryIf: (error) => {
      // In addition to default network and 5xx errors, also retry specific business error codes
      if (error.data?.ResponseMetadata?.Error?.Code === "ResourceIsBusy") {
        return true;
      }
      // You can call the SDK's built-in shouldRetry function to reuse default logic
      // return shouldRetry(error);
      return false; // Return false to indicate no retry
    },

    // Custom delay calculation logic
    delay: (attemptNumber) => {
      // Wait 1 second fixed for each retry
      return 1000;
    },
  },
});
```

## Exception Handling

When a request fails, the SDK throws an instance of `HttpRequestError`. This error object contains rich debugging information. `HttpRequestError` has three `name` types:

- `ApiException`: Indicates an error response received from the server, such as parameter error, resource does not exist, etc.
  - `status`: HTTP status code.
  - `data`: Complete error information body returned by the server.
- `NetworkError`: Indicates a network-level error occurred, such as DNS resolution failure, connection timeout, etc. At this time, there is no `status` and `data`.
- `Exception`: Other unclassified exceptions.

```typescript
import { HttpRequestError } from "@volcengine/sdk-core";

try {
  await client.send(command);
} catch (error) {
  // Use instanceof to determine if it is a standard exception thrown by the SDK
  if (error instanceof HttpRequestError) {
    // 1. If HTTP status code (status) exists, it usually indicates the server returned an error or SSL handshake failed
    if (error.status !== undefined) {
      // 1.1 SSL Error (status === 0)
      if (error.status === 0) {
        console.error(`❌ SSL Error`);
      }
      // 1.2 Server returned error (status > 0)
      else {
        // Attempt to read detailed error information returned by the server (ResponseMetadata)
        if (error.data?.ResponseMetadata?.Error) {
          const { Code, Message } = error.data.ResponseMetadata.Error;
          const { RequestId } = error.data.ResponseMetadata;
          console.error(`❌ API Error [${Code}]: ${Message}`);
          console.error(`   RequestId: ${RequestId}`);
        } else {
          // Other HTTP errors (such as 404, 500, 502, etc.)
        }
      }
    }
    // 2. Handle network exceptions (NetworkError)
    // Scenario: Timeout, DNS resolution failure, unable to connect, etc. (usually no status)
    else if (error.name === "NetworkError") {
      console.error("❌ Network Error Occurred:");
      console.error(`   Message: ${error.message}`);
      // View original error code (such as ECONNREFUSED, ETIMEDOUT, etc.)
      if (error.originalError && (error.originalError as any).code) {
        console.error(`   Code:    ${(error.originalError as any).code}`);
      }
    }
    // 3. Handle other SDK exceptions (Exception)
    else {
      console.error("❌ SDK Exception Occurred");
    }
  }
  // 4. Unknown error (Error not thrown by SDK)
  else {
    console.error("❌ Unknown Error");
  }
}
```

### Resource Cleanup

The client may hold resources such as network connections. Before the application exits, you can call the `destroy` method to ensure these resources are correctly released.

```typescript
client.destroy();
```

## Debug Mechanism

To facilitate troubleshooting and debugging when handling requests, the SDK supports middleware logging functionality. You can inject custom middleware to print detailed information about requests and responses.

```typescript
import { EcsClient } from "@volcengine/ecs";

const client = new EcsClient({
  region: "cn-beijing",
  // ... other configurations
});

// Add logging middleware
client.middlewareStack.add(
  (next, context) => async (args) => {
    // 1. Print before request
    const { request } = args;
    console.log(
      "👉 [Request]:",
      request.method,
      request.protocol + "://" + request.host + request.pathname
    );
    // console.log("   Headers:", request.headers);
    // console.log("   Body:", request.body);

    // 2. Execute next middleware
    const result = await next(args);

    // 3. Print after response
    const { response } = result;
    if (response) {
      console.log("👈 [Response]:", response.status, response.statusText);
      // console.log("   Headers:", response.headers);
      // console.log("   Data:", response.data);
    }

    return result;
  },
  {
    step: "finalizeRequest", // Execute in the final stage of sending request
    name: "LogMiddleware", // Middleware name
    priority: 10, // Priority
  }
);
```

## Environment Variables Description

The SDK supports configuring client behavior via environment variables. These environment variables are automatically read when creating the Client. If the same configuration is provided in the Client constructor, the configuration in the constructor takes precedence.

| Environment Variable Name                              | Description                                      | Corresponding ClientConfig Field | Default Value |
| :----------------------------------------------------- | :----------------------------------------------- | :------------------------------- | :------------ |
| `VOLCSTACK_ACCESS_KEY_ID` / `VOLCSTACK_ACCESS_KEY`     | Access Key ID                                    | `accessKeyId`                    | -             |
| `VOLCSTACK_SECRET_ACCESS_KEY` / `VOLCSTACK_SECRET_KEY` | Secret Access Key                                | `secretAccessKey`                | -             |
| `VOLCSTACK_SESSION_TOKEN`                              | Temporary Session Token                          | `sessionToken`                   | -             |
| `VOLC_ENABLE_DUALSTACK`                                | Whether to enable dual-stack (IPv4+IPv6) support | `useDualStack`                   | `false`       |
| `VOLC_BOOTSTRAP_REGION_LIST_CONF`                      | Custom bootstrap region list file path           | -                                | -             |
| `VOLC_PROXY_PROTOCOL`                                  | Proxy protocol (`http` / `https`)                | `httpOptions.proxy.protocol`     | `http`        |
| `VOLC_PROXY_HOST`                                      | Proxy host address                               | `httpOptions.proxy.host`         | `127.0.0.1`   |
| `VOLC_PROXY_PORT`                                      | Proxy port                                       | `httpOptions.proxy.port`         | -             |
