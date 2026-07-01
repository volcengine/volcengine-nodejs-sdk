[中文](0-Overview-zh.md) | Overview

---

# Volcengine Node.js SDK Integration Guide

## Requirements

- Node.js >= 18

## Installation

It is recommended to use `pnpm` for installation, but `npm` and `yarn` are also supported.

1. Install Core Package

```bash
# pnpm
pnpm add @volcengine/sdk-core

# npm
npm install @volcengine/sdk-core

# yarn
yarn add @volcengine/sdk-core
```

2. Install Service SDK Package

   Take installing ECS service SDK package as an example:

```bash
# pnpm
pnpm add @volcengine/ecs

# npm
npm install @volcengine/ecs

# yarn
yarn add @volcengine/ecs
```

## Section Index

1. [Credentials](1-Credentials.md) — AK/SK, STS, AssumeRole, OIDC, SAML, ECS role, default credential chain
2. [Endpoint Configuration](2-Endpoint.md) — Custom endpoint, region ID, automatic resolution
3. [Transport](3-Transport.md) — Protocol scheme, SSL verification, connection pool
4. [Proxy](4-Proxy.md) — HTTP(S) proxy configuration in code and environment variables
5. [Timeouts](5-Timeout.md) — Client timeout, per-request timeout, connect/read timeout split
6. [Retries](6-Retry.md) — Retry conditions, backoff strategies, custom retry
7. [Error Handling](7-ErrorHandling.md) — Exception types, error codes, resource cleanup
8. [Debugging](8-Debugging.md) — Debug options, log levels, custom middleware
- [Environment Variables](EnvironmentVariables.md) — All environment variables supported by the SDK

---

[中文](0-Overview-zh.md) | Overview
