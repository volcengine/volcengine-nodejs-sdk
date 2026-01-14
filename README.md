中文 | [English](README.EN.MD)

# Volcengine SDK for Node.js

## 安装

### 环境要求

- Node.js >= 18

  推荐使用 `pnpm` 进行安装，同时支持 `npm` 和 `yarn`。

```bash
# pnpm
pnpm add @volcengine/sdk-core

# npm
npm install @volcengine/sdk-core

# yarn
yarn add @volcengine/sdk-core
```

## 环境变量设置

SDK 会自动读取以下环境变量作为访问凭据：

- `VOLCSTACK_ACCESS_KEY_ID` 或 `VOLCSTACK_ACCESS_KEY`: Access Key ID
- `VOLCSTACK_SECRET_ACCESS_KEY` 或 `VOLCSTACK_SECRET_KEY`: Secret Access Key

配置环境变量后，无需在代码中再次配置凭据。

```bash
export VOLCSTACK_ACCESS_KEY_ID="YOUR_AK"
export VOLCSTACK_SECRET_ACCESS_KEY="YOUR_SK"
```

## Endpoint 设置

SDK 支持多种方式配置 Endpoint，优先级从高到低：

1.  **自定义 Endpoint**: 在客户端配置中指定 `host` (e.g. `open.volcengineapi.com`).
2.  **自动寻址**: 指定 `region`，SDK 会根据服务名和区域自动构造 Endpoint (e.g. `ecs.cn-beijing.volcengineapi.com`).
3.  **默认**: 如果未指定且无法推导，默认使用 `open.volcengineapi.com`.

## 快速开始

以下示例展示了如何初始化客户端并发送请求。
安装对应的业务 SDK 包（如 `@volcengine/iam`）。

```bash
# pnpm
pnpm add @volcengine/iam

```

```typescript
import { IAMClient } from "@volcengine/iam"; // 需安装对应的业务包

// 1. 使用环境变量中的 AK/SK，并指定 Region
const client = new IAMClient({
  region: "cn-beijing",
});

// 2. 或者在代码中显式传入 AK/SK
// const client = new IAMClient({
//   accessKeyId: "YOUR_AK",
//   secretAccessKey: "YOUR_SK",
//   region: "cn-beijing",
// });

async function main() {
  try {
    // 发送请求 (具体 Command 需参考业务 SDK 文档)
    const command = new ListUsersCommand({});
    const response = await client.send(command);
    console.log(response);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
```

更多代码示例请参考：[SDK 接入文档](./SDK_Integration_zh.md)
