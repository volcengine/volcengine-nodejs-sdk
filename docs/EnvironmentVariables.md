[← Overview](0-Overview.md) | Environment Variables [(中文)](EnvironmentVariables-zh.md)

---

## Environment Variables

This page lists all environment variables supported by the SDK for deployment/CI injection.

### Setup

#### Linux / macOS

Temporary (current shell):

```shell
export VOLCENGINE_ACCESS_KEY=your-ak
export VOLCENGINE_SECRET_KEY=your-sk
# optional
export VOLCENGINE_SESSION_TOKEN=your-session-token
```

Persistent: Add `export` lines to `~/.bashrc`, `~/.zshrc`, etc.

Verify: `echo $VOLCENGINE_ACCESS_KEY` should return the expected value.

#### Windows

Command line (run as administrator):

```cmd
setx VOLCENGINE_ACCESS_KEY your-ak /M
setx VOLCENGINE_SECRET_KEY your-sk /M
setx VOLCENGINE_SESSION_TOKEN your-session-token /M
```

`/M` means system-level; omit `/M` for user-level.

---

### Credentials

#### Basic AK/SK/Token

| Variable                   | Description                 | Required |
| -------------------------- | --------------------------- | :------: |
| `VOLCENGINE_ACCESS_KEY`    | Access Key                  |    ✅    |
| `VOLCENGINE_SECRET_KEY`    | Secret Key                  |    ✅    |
| `VOLCENGINE_SESSION_TOKEN` | STS temporary Session Token |    ❌    |

#### OIDC (AssumeRoleWithOIDC)

| Variable                            | Description                  | Required |
| ----------------------------------- | ---------------------------- | :------: |
| `VOLCENGINE_OIDC_ROLE_TRN`          | Role TRN to assume           |    ✅    |
| `VOLCENGINE_OIDC_TOKEN_FILE`        | OIDC token file path         |    ✅    |
| `VOLCENGINE_OIDC_ROLE_SESSION_NAME` | Role session name            |    ❌    |
| `VOLCENGINE_OIDC_STS_ENDPOINT`      | Custom STS endpoint          |    ❌    |
| `VOLCENGINE_OIDC_ROLE_POLICY`       | Session policy (JSON string) |    ❌    |

#### SAML (AssumeRoleWithSAML)

| Variable                       | Description                     | Required |
| ------------------------------ | ------------------------------- | :------: |
| `VOLCENGINE_SAML_ROLE_TRN`     | Role TRN to assume              |    ✅    |
| `VOLCENGINE_SAML_ACCOUNT_ID`   | Volcengine account ID           |    ✅    |
| `VOLCENGINE_SAML_PROVIDER_TRN` | SAML identity provider TRN      |    ✅    |
| `VOLCENGINE_SAML_ASSERTION`    | SAML assertion (Base64 encoded) |    ✅    |
| `VOLCENGINE_SAML_ENDPOINT`     | Custom STS endpoint             |    ❌    |
| `VOLCENGINE_SAML_POLICY`       | Session policy (JSON string)    |    ❌    |

#### ECS Instance Role (IMDS)

| Variable                           | Description                                                              | Default |
| ---------------------------------- | ------------------------------------------------------------------------ | ------- |
| `VOLCENGINE_ECS_METADATA`          | Specify ECS instance role name; if unset, auto-detected from IMDS         | -       |
| `VOLCENGINE_ECS_METADATA_DISABLED` | Set to `true` to disable IMDS credential retrieval                       | -       |

#### CLI Config File

| Variable                     | Description          | Default                     |
| ---------------------------- | -------------------- | --------------------------- |
| `VOLCENGINE_CLI_CONFIG_FILE` | CLI config file path | `~/.volcengine/config.json` |

---

### Endpoint & Network

| Variable                          | Description                                                  | Default |
| --------------------------------- | ------------------------------------------------------------ | ------- |
| `VOLC_ENABLE_DUALSTACK`           | Enable dual-stack (IPv4+IPv6), set to `true` to enable       | `false` |
| `VOLC_BOOTSTRAP_REGION_LIST_CONF` | Custom bootstrap region list file path (one region per line) | -       |

---

### HTTP Proxy

When either `VOLC_PROXY_HOST` or `VOLC_PROXY_PORT` is set, the SDK automatically enables proxy.

| Variable              | Description                       | Default                     |
| --------------------- | --------------------------------- | --------------------------- |
| `VOLC_PROXY_PROTOCOL` | Proxy protocol (`http` / `https`) | `http`                      |
| `VOLC_PROXY_HOST`     | Proxy host address                | `127.0.0.1`                 |
| `VOLC_PROXY_PORT`     | Proxy port                        | `80` (http) / `443` (https) |

---

### Default Credential Chain Order

When no credentials are explicitly configured, `DefaultCredentialProvider` tries providers in the following order (first success wins):

| Order | Provider                              | Dependent Environment Variables                                                                 |
| :---: | ------------------------------------- | ----------------------------------------------------------------------------------------------- |
|   1   | EnvironmentVariableCredentialProvider | `VOLCENGINE_ACCESS_KEY` / `VOLCSTACK_ACCESS_KEY_ID` / `VOLCSTACK_ACCESS_KEY` + corresponding SK |
|   2   | OidcCredentialProvider                | `VOLCENGINE_OIDC_ROLE_TRN` + `VOLCENGINE_OIDC_TOKEN_FILE`                                       |
|   3   | CLIConfigCredentialProvider           | `VOLCENGINE_CLI_CONFIG_FILE` (optional)                                                         |
|   4   | EcsRoleCredentialProvider             | `VOLCENGINE_ECS_METADATA` (optional), skipped when `VOLCENGINE_ECS_METADATA_DISABLED=true`      |

---

### Priority Summary

| Configuration Item   | Priority (high → low)                                                           |
| -------------------- | ------------------------------------------------------------------------------- |
| AK/SK/Token          | `VOLCENGINE_*` > `VOLCSTACK_*_ID` > `VOLCSTACK_*`                               |
| OIDC STS Endpoint    | Constructor parameter `host` > `VOLCENGINE_OIDC_STS_ENDPOINT`                   |
| SAML STS Endpoint    | Constructor parameter `host` > `VOLCENGINE_SAML_ENDPOINT`                       |
| CLI config file path | `VOLCENGINE_CLI_CONFIG_FILE` > `~/.volcengine/config.json`                      |
| ECS Role name        | Constructor parameter `roleName` > `VOLCENGINE_ECS_METADATA` > IMDS auto-detect |
| DualStack            | Constructor parameter `useDualStack` > `VOLC_ENABLE_DUALSTACK`                  |
| Proxy                | Constructor parameter `httpOptions.proxy` > `VOLC_PROXY_*`                      |

---

### Legacy Compatible Variables (`VOLCSTACK_*`)

Earlier SDKs used the `VOLCSTACK_*` prefix. When the equivalent `VOLCENGINE_*` variable is not set, the following variables serve as fallback. **New code should use `VOLCENGINE_*` exclusively.**

| Variable                                               | Equivalent `VOLCENGINE_*`  | Node.js | Go  | Python |
| ------------------------------------------------------ | -------------------------- | :-----: | :-: | :----: |
| `VOLCSTACK_ACCESS_KEY_ID` / `VOLCSTACK_ACCESS_KEY`     | `VOLCENGINE_ACCESS_KEY`    |   ✅    | ✅  |   ❌   |
| `VOLCSTACK_SECRET_ACCESS_KEY` / `VOLCSTACK_SECRET_KEY` | `VOLCENGINE_SECRET_KEY`    |   ✅    | ✅  |   ❌   |
| `VOLCSTACK_SESSION_TOKEN`                              | `VOLCENGINE_SESSION_TOKEN` |   ✅    | ✅  |   ❌   |

Fallback priority: `VOLCENGINE_*` > `VOLCSTACK_*_ID` > `VOLCSTACK_*`

---

### Related Documentation

- [Credentials](1-Credentials.md) — Code-level usage of each Provider
- [Endpoint Configuration](2-Endpoint.md) — DualStack, bootstrap region list details
- [Proxy](4-Proxy.md) — Proxy configuration code-level usage

---

[← Overview](0-Overview.md) | Environment Variables [(中文)](EnvironmentVariables-zh.md)
