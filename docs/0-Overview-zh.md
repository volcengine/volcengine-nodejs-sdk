[English](0-Overview.md) | 概览

---

# 火山引擎 Node.js SDK 接入文档

## 环境要求

- Node.js >= 18

## 安装

推荐使用 `pnpm` 进行安装，同时支持 `npm` 和 `yarn`。

1. 安装 Core 包

```bash
# pnpm
pnpm add @volcengine/sdk-core

# npm
npm install @volcengine/sdk-core

# yarn
yarn add @volcengine/sdk-core
```

2. 安装云产品 SDK 包

   以安装 ECS 业务 SDK 包为例：

```bash
# pnpm
pnpm add @volcengine/ecs

# npm
npm install @volcengine/ecs

# yarn
yarn add @volcengine/ecs
```

## 章节索引

1. [访问凭据](1-Credentials-zh.md) — AK/SK、STS、AssumeRole、OIDC、SAML、ECS 角色、默认凭证链
2. [Endpoint 配置](2-Endpoint-zh.md) — 自定义 Endpoint、RegionId、自动化寻址
3. [Transport](3-Transport-zh.md) — 协议 Scheme、SSL 验证、连接池
4. [代理配置](4-Proxy-zh.md) — HTTP(S) 代理的代码配置与环境变量
5. [超时配置](5-Timeout-zh.md) — 客户端超时、请求级超时、连接/读取超时拆分
6. [重试策略](6-Retry-zh.md) — 重试条件、退避策略、自定义重试
7. [错误处理](7-ErrorHandling-zh.md) — 异常类型、错误码、资源清理
8. [调试模式](8-Debugging-zh.md) — Debug 选项、日志级别、自定义中间件

- [环境变量参考](EnvironmentVariables-zh.md) — 所有 SDK 支持的环境变量

---

[English](0-Overview.md) | 概览
