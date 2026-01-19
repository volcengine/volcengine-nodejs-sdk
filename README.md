中文 | [English](README.EN.md)

# Volcengine SDK for Node.js

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

## 环境变量设置

SDK 会自动读取以下环境变量作为访问凭据：

- `VOLCSTACK_ACCESS_KEY_ID` 或 `VOLCSTACK_ACCESS_KEY`: Access Key ID
- `VOLCSTACK_SECRET_ACCESS_KEY` 或 `VOLCSTACK_SECRET_KEY`: Secret Access Key

配置环境变量后，无需在代码中再次配置凭据。

```bash
export VOLCSTACK_ACCESS_KEY_ID="YOUR_AK"
export VOLCSTACK_SECRET_ACCESS_KEY="YOUR_SK"
```

## 快速开始

以下示例展示了如何初始化客户端并发送请求。

```typescript
import { ECSClient, DescribeZonesCommand } from "@volcengine/ecs"; // 需安装对应的业务包

// 1. 使用环境变量中的 AK/SK，并指定 Region
const client = new ECSClient({
  region: "cn-beijing",
});

// 2. 或者在代码中显式传入 AK/SK
// const client = new ECSClient({
//   accessKeyId: "YOUR_AK",
//   secretAccessKey: "YOUR_SK",
//   region: "cn-beijing",
// });

async function main() {
  try {
    // 发送请求 (具体 Command 需参考业务 SDK 文档)
    const command = new DescribeZonesCommand({});
    const response = await client.send(command);
    console.log(response);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
```

更多代码示例请参考：[SDK 接入文档](./SDK_Integration_zh.md)
