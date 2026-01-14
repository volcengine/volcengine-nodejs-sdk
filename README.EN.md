English | [中文](README.md)

# Volcengine SDK for Node.js

## Installation

### Requirements

- Node.js >= 18

Recommended to use `pnpm` for installation. `npm` and `yarn` are also supported.

```bash
# pnpm
pnpm add @volcengine/sdk-core

# npm
npm install @volcengine/sdk-core

# yarn
yarn add @volcengine/sdk-core
```

## Environment Variables

The SDK automatically reads the following environment variables as access credentials:

- `VOLCSTACK_ACCESS_KEY_ID` or `VOLCSTACK_ACCESS_KEY`: Access Key ID
- `VOLCSTACK_SECRET_ACCESS_KEY` or `VOLCSTACK_SECRET_KEY`: Secret Access Key

After configuring environment variables, you do not need to configure credentials in the code again.

```bash
export VOLCSTACK_ACCESS_KEY_ID="YOUR_AK"
export VOLCSTACK_SECRET_ACCESS_KEY="YOUR_SK"
```

## Endpoint Configuration

The SDK supports multiple ways to configure the Endpoint, with the following priority (highest to lowest):

1.  **Custom Endpoint**: Specify `EndpointWithEndpoint` in the client configuration (e.g. `iam.example.com`).
2.  **Automatic Addressing**: Specify `region`, and the SDK will automatically construct the Endpoint based on the service name and region (e.g. `ecs.cn-beijing.volcengineapi.com`).
3.  **Default**: If not specified and cannot be deduced, `open.volcengineapi.com` is used by default.

## Quick Start

The following example shows how to initialize the client and send a request.
Install the corresponding service SDK package (e.g., `@volcengine/iam`).

```bash
# pnpm
pnpm add @volcengine/iam
```

```typescript
import { IAMClient, ListUsersCommand } from "@volcengine/iam"; // Need to install the corresponding service package

// 1. Use AK/SK from environment variables and specify Region
const client = new IAMClient({
  region: "cn-beijing",
});

// 2. Or explicitly pass AK/SK in the code
// const client = new IAMClient({
//   accessKeyId: "YOUR_AK",
//   secretAccessKey: "YOUR_SK",
//   region: "cn-beijing",
// });

async function main() {
  try {
    // Send request (refer to service SDK documentation for specific Commands)
    const command = new ListUsersCommand({});
    const response = await client.send(command);
    console.log(response);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
```

For more code examples, please refer to: [SDK Integration Documentation](./SDK_Integration.md)
