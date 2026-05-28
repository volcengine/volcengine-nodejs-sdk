[← Overview](0-Overview.md) | Credentials [(中文)](1-Credentials-zh.md) | [Endpoint Configuration →](2-Endpoint.md)

---

## Credentials

To ensure secure resource access, the Volcengine Node.js SDK supports both explicit credentials and automatic resolution via `CredentialProvider`.

### CredentialProvider Overview

| Provider                                | Purpose                          | Auto-Refresh              | Typical Scenario                      |
| --------------------------------------- | -------------------------------- | ------------------------- | ------------------------------------- |
| `StaticCredentialProvider`              | Static AK/SK(/Token)             | No                        | Server-side long-term credentials     |
| `StsAssumeRoleProvider`                 | STS AssumeRole                   | Yes                       | Role assumption temporary credentials |
| `OidcCredentialProvider`                | STS AssumeRoleWithOIDC           | Yes                       | OIDC federated identity               |
| `SamlCredentialProvider`                | STS AssumeRoleWithSAML           | Yes                       | SAML federated identity               |
| `EnvironmentVariableCredentialProvider` | Read environment variables       | No                        | CI/CD, container injection            |
| `CLIConfigCredentialProvider`           | Read `~/.volcengine/config.json` | No                        | Reuse CLI configuration               |
| `EcsRoleCredentialProvider`             | Read ECS IMDS                    | Yes                       | ECS instance role                     |
| `DefaultCredentialProvider`             | Default chain wrapper            | Depends on proxy Provider | No AK/SK in business code             |

### AK/SK Configuration

AK/SK is a pair of permanent access keys created by Volcengine users in the console. The SDK uses these keys to sign each request for authentication.

> ⚠️ **Important**
>
> 1. Never embed or expose AK/SK in client-side code.
> 2. Use configuration centers or environment variables to store keys.
> 3. Configure least-privilege access policies.

#### 1. Configure in Code (⚠️ Not Recommended)

```typescript
import { EcsClient } from "@volcengine/ecs";

const client = new EcsClient({
  accessKeyId: "YOUR_AK",
  secretAccessKey: "YOUR_SK",
  region: "cn-beijing",
});
```

#### 2. Use Environment Variables (Recommended)

The SDK automatically reads the following environment variables:

- **Access Key ID**: `VOLCENGINE_ACCESS_KEY`
- **Secret Access Key**: `VOLCENGINE_SECRET_KEY`

```bash
export VOLCENGINE_ACCESS_KEY="YOUR_AK"
export VOLCENGINE_SECRET_KEY="YOUR_SK"
```

```typescript
const client = new EcsClient({ region: "cn-beijing" });
```

### STS Token Configuration

STS (Security Token Service) is a temporary credential mechanism provided by Volcengine. Developers call the STS API on the server side to obtain temporary credentials (temporary AK, SK, and Token) with a configurable expiry, suitable for scenarios with high security requirements.

> ⚠️ **Important**
>
> 1. Least privilege: only grant the minimum permissions required, avoid granting full resource/action access with \* wildcards.
> 2. Set a reasonable expiry: the shorter the safer, recommended no more than 1 hour.

```typescript
const client = new EcsClient({
  accessKeyId: "YOUR_TEMP_AK",
  secretAccessKey: "YOUR_TEMP_SK",
  sessionToken: "YOUR_SESSION_TOKEN",
  region: "cn-beijing",
});

// Or via environment variable:
// export VOLCENGINE_SESSION_TOKEN="YOUR_SESSION_TOKEN"
```

### STS AssumeRole Example

STS AssumeRole is a temporary credential mechanism provided by Volcengine. It uses an IAM sub-account role to perform the AssumeRole operation, then obtains temporary credentials to make API requests.

Reference: https://www.volcengine.com/docs/6257/86374

> ⚠️ **Important**
>
> 1. Least privilege: only grant the minimum permissions required.
> 2. Set a reasonable expiry: the shorter the safer, recommended no more than 1 hour.

```typescript
import { StsAssumeRoleProvider } from "@volcengine/sdk-core";
import { EcsClient } from "@volcengine/ecs";

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

const client = new EcsClient({
  region: "cn-beijing",
  credentialProvider,
});
```

### STS AssumeRoleWithOIDC Example

`OidcCredentialProvider` obtains temporary credentials via STS `AssumeRoleWithOIDC`. Suitable for scenarios where an OIDC identity provider is already integrated. It uses an OIDC Token to perform the AssumeRoleWithOIDC operation to obtain temporary credentials for API requests.

Reference: https://www.volcengine.com/docs/6257/1494877

> ⚠️ **Important**
>
> 1. Least privilege: only grant the minimum permissions required, avoid granting full resource/action access with \* wildcards.
> 2. Set a reasonable expiry: the shorter the safer, recommended no more than 1 hour.

Supported environment variables:

| Variable                            | Description                  | Required |
| ----------------------------------- | ---------------------------- | :------: |
| `VOLCENGINE_OIDC_ROLE_TRN`          | Role TRN to assume           |    ✅    |
| `VOLCENGINE_OIDC_TOKEN_FILE`        | OIDC token file path         |    ✅    |
| `VOLCENGINE_OIDC_ROLE_SESSION_NAME` | Role session name            |    ❌    |
| `VOLCENGINE_OIDC_ROLE_POLICY`       | Session policy (JSON string) |    ❌    |
| `VOLCENGINE_OIDC_STS_ENDPOINT`      | Custom STS endpoint          |    ❌    |

```typescript
import { OidcCredentialProvider } from "@volcengine/sdk-core";
import { EcsClient } from "@volcengine/ecs";

// Explicit parameters (all options)
const credentialProvider = new OidcCredentialProvider({
  roleTrn: "trn:iam::2110400000:role/oidc-role",
  oidcTokenFile: "/path/to/oidc/token",
  roleSessionName: "my-session",
  host: "sts.volcengineapi.com",
  policy:
    '{"Statement":[{"Effect":"Allow","Action":["ecs:Describe*"],"Resource":["*"]}]}',
});

// Or auto-read from environment variables (no-arg constructor)
const credentialProvider2 = new OidcCredentialProvider();

const client = new EcsClient({
  region: "cn-beijing",
  credentialProvider,
});
```

### STS AssumeRoleWithSAML Example

`SamlCredentialProvider` obtains temporary credentials via STS `AssumeRoleWithSAML`. Suitable for SAML federated identity scenarios. It uses a SAML assertion to perform the AssumeRoleWithSAML operation to obtain temporary credentials for API requests.

Reference: https://www.volcengine.com/docs/6257/1631607

> ⚠️ **Important**
>
> 1. Least privilege: only grant the minimum permissions required, avoid granting full resource/action access with \* wildcards.
> 2. Set a reasonable expiry: the shorter the safer, recommended no more than 1 hour.

Supported environment variables:

| Variable                       | Description                     | Required |
| ------------------------------ | ------------------------------- | :------: |
| `VOLCENGINE_SAML_ROLE_TRN`     | Role TRN to assume              |    ✅    |
| `VOLCENGINE_SAML_ACCOUNT_ID`   | Volcengine account ID           |    ✅    |
| `VOLCENGINE_SAML_PROVIDER_TRN` | SAML identity provider TRN      |    ✅    |
| `VOLCENGINE_SAML_ASSERTION`    | SAML assertion (Base64 encoded) |    ✅    |
| `VOLCENGINE_SAML_ENDPOINT`     | Custom STS endpoint             |    ❌    |
| `VOLCENGINE_SAML_POLICY`       | Session policy (JSON string)    |    ❌    |

```typescript
import { SamlCredentialProvider } from "@volcengine/sdk-core";
import { EcsClient } from "@volcengine/ecs";

// Explicit parameters (all options)
const credentialProvider = new SamlCredentialProvider({
  roleTrn: "trn:iam::2110400000:role/saml-role",
  accountId: "2110400000",
  samlProviderTrn: "trn:iam::2110400000:saml-provider/my-provider",
  samlAssertion: "BASE64_ENCODED_SAML_ASSERTION",
  host: "sts.volcengineapi.com",
  policy:
    '{"Statement":[{"Effect":"Allow","Action":["ecs:Describe*"],"Resource":["*"]}]}',
});

// Or auto-read from environment variables (no-arg constructor)
const credentialProvider2 = new SamlCredentialProvider();

const client = new EcsClient({
  region: "cn-beijing",
  credentialProvider,
});
```

### Environment Variable Credential Provider

`EnvironmentVariableCredentialProvider` reads the following environment variables:

- `VOLCSTACK_ACCESS_KEY_ID` / `VOLCSTACK_ACCESS_KEY`
- `VOLCSTACK_SECRET_ACCESS_KEY` / `VOLCSTACK_SECRET_KEY`
- `VOLCSTACK_SESSION_TOKEN` (optional)

```typescript
import {
  EnvironmentVariableCredentialProvider,
  EcsClient,
} from "@volcengine/sdk-core";

const credentialProvider = new EnvironmentVariableCredentialProvider();
const client = new EcsClient({
  region: "cn-beijing",
  credentialProvider,
});
```

### CLI Config Credential Provider

`CLIConfigCredentialProvider` reads from `~/.volcengine/config.json` by default.

- Config file priority: `VOLCENGINE_CLI_CONFIG_FILE` env var > default path `~/.volcengine/config.json`

```typescript
import { CLIConfigCredentialProvider, EcsClient } from "@volcengine/sdk-core";

const credentialProvider = new CLIConfigCredentialProvider();
const client = new EcsClient({
  region: "cn-beijing",
  credentialProvider,
});
```

### ECS Role Credential Provider

> 🚨 **Current Version Limitation**
>
> **The current version does not support auto-detecting role names from IMDS.** You must explicitly provide the role name via the constructor parameter or the `VOLCENGINE_ECS_METADATA` environment variable. Auto-detection will be supported in a future release.

`EcsRoleCredentialProvider` obtains temporary credentials from the ECS Instance Metadata Service (IMDSv2):

- `roleName` priority: constructor parameter > `VOLCENGINE_ECS_METADATA`
- Disable switch: `VOLCENGINE_ECS_METADATA_DISABLED=true`

| Variable                           | Description                                                             |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `VOLCENGINE_ECS_METADATA`          | Specify ECS instance role name (required unless passed via constructor) |
| `VOLCENGINE_ECS_METADATA_DISABLED` | Set to `true` to disable IMDS credential retrieval                      |

```typescript
import { EcsRoleCredentialProvider } from "@volcengine/sdk-core";
import { EcsClient } from "@volcengine/ecs";

// Explicit role name
const credentialProvider = new EcsRoleCredentialProvider({
  roleName: "your-ecs-role-name",
});

// Custom timeout and retry
const credentialProvider2 = new EcsRoleCredentialProvider({
  roleName: "your-ecs-role-name",
  connectTimeout: 2, // Connect timeout (seconds), default 1
  readTimeout: 2, // Read timeout (seconds), default 1
  maxRetries: 5, // Max retry attempts, default 3
  retryInterval: 2, // Retry interval (seconds), default 1
  expiredBufferSeconds: 600, // Early refresh window (seconds), default 300
});

const client = new EcsClient({
  region: "cn-beijing",
  credentialProvider,
});
```

### DefaultCredentialProvider (Default Credential Chain)

`DefaultCredentialProvider` attempts to obtain credentials in the following order, returning the first successful result:

1. **EnvironmentVariableCredentialProvider** — read from environment variables
2. **OidcCredentialProvider** — obtain temporary credentials via OIDC
3. **CLIConfigCredentialProvider** — read from CLI config file
4. **EcsRoleCredentialProvider** — obtain temporary credentials via ECS IMDS (skipped when `VOLCENGINE_ECS_METADATA_DISABLED=true`)

```typescript
import { DefaultCredentialProvider, EcsClient } from "@volcengine/sdk-core";

// Basic usage
const credentialProvider = new DefaultCredentialProvider();

const client = new EcsClient({
  region: "cn-beijing",
  credentialProvider,
});
```

With `DefaultCredentialProvider`, the SDK automatically traverses the credential chain without manually specifying AK/SK.

---

[← Overview](0-Overview.md) | Credentials [(中文)](1-Credentials-zh.md) | [Endpoint Configuration →](2-Endpoint.md)
