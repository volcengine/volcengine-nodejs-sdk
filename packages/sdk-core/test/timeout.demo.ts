/**
 * SDK Core 超时配置演示
 *
 * 说明：SDK Core 支持在多个级别配置超时，优先级从高到低为：
 * 1. request.timeout（单个请求级别）
 * 2. config.httpOptions.timeout（客户端级别）
 * 3. 默认值 10000ms（10秒）
 */

import { Client, Command } from "../src/index";
import { AxiosRequestHandler } from "../src/request-handlers/axios-handler";

// ============================================================================
// 示例 1: 客户端级别超时配置
// ============================================================================

// 创建客户端时配置超时（适用于所有请求）
const clientWithTimeout = new Client({
  host: "example.com",
  region: "cn-beijing",
  accessKeyId: "your-access-key",
  secretAccessKey: "your-secret-key",

  httpOptions: {
    timeout: 5000, // 5秒超时
  },
});

// ============================================================================
// 示例 2: 使用自定义 RequestHandler 配置超时
// ============================================================================

// 方式 A: 使用 AxiosRequestHandler 并配置超时
const axiosHandler = new AxiosRequestHandler({
  timeout: 8000, // 8秒超时
});

const clientWithHandler = new Client({
  host: "example.com",
  region: "cn-beijing",
  accessKeyId: "your-access-key",
  secretAccessKey: "your-secret-key",
  requestHandler: axiosHandler,
});

// 方式 B: 使用默认的 AxiosRequestHandler（通过 httpOptions 配置）
const clientDefaultHandler = new Client({
  host: "example.com",
  region: "cn-beijing",
  accessKeyId: "your-access-key",
  secretAccessKey: "your-secret-key",

  httpOptions: {
    timeout: 5000, // 将会被传递给 AxiosRequestHandler
  },
});

// ============================================================================
// 示例 3: 单个请求级别超时配置
// ============================================================================

// 为特定请求设置不同的超时（优先级最高）
const client = new Client({
  host: "example.com",
  region: "cn-beijing",
  accessKeyId: "your-access-key",
  secretAccessKey: "your-secret-key",
  httpOptions: {
    timeout: 5000, // 默认 5 秒超时
  },
});

// 发送请求前，通过 middleware 设置请求级别的超时
const longRunningCommand = new Command({
  // 命令参数
});

// 添加 middleware 为特定请求设置超时
client.middlewareStack.add(
  (next, context) => async (args: any) => {
    // 为长时间运行的操作设置更长的超时
    args.request.timeout = 30000; // 30 秒
    return next(args);
  },
  { step: "initialize", name: "setLongTimeout", priority: 100 }
);

// 发送请求（将会使用 30 秒超时，而不是 5 秒）
// await client.send(longRunningCommand);

// ============================================================================
// 示例 4: 通用请求超时配置函数
// ============================================================================

/**
 * 为命令设置请求超时
 */
function setRequestTimeout(command: Command, timeoutMs: number): void {
  command.middlewareStack.add(
    (next, context) => async (args: any) => {
      args.request.timeout = timeoutMs;
      return next(args);
    },
    { step: "initialize", name: `setTimeout_${timeoutMs}ms`, priority: 100 }
  );
}

// 使用示例
const uploadCommand = new Command({
  file: "large-file.zip",
});

// 为上传操作设置 30 秒超时
setRequestTimeout(uploadCommand, 30000);

// 发送请求
// await client.send(uploadCommand);

// ============================================================================
// 示例 5: 根据不同条件动态设置超时
// ============================================================================

// 根据请求类型设置不同的超时
function addDynamicTimeoutMiddleware(client: Client): void {
  client.middlewareStack.add(
    (next, context) => async (args: any) => {
      const action = args.request.params?.Action;

      // 为不同的 API 操作设置不同的超时
      switch (action) {
        case "UploadLargeFile":
          args.request.timeout = 60000; // 60 秒
          break;
        case "GetRealTimeData":
          args.request.timeout = 2000; // 2 秒
          break;
        case "BatchProcess":
          args.request.timeout = 30000; // 30 秒
          break;
        default:
          // 使用客户端配置的默认值
          break;
      }

      return next(args);
    },
    { step: "initialize", name: "dynamicTimeout", priority: 90 }
  );
}

// ============================================================================
// 示例 6: 超时错误处理
// ============================================================================

async function handleRequestWithTimeout() {
  const command = new Command({
    data: "test-data",
  });

  (command as any).requestConfig = {
    method: "POST",
    serviceName: "test-service",
    params: { Action: "TestAction", Version: "2023-01-01" },
  };

  try {
    const result = await client.send(command);
  } catch (error: any) {
    if (error.message?.includes("timeout")) {
      console.error("Request timed out. Consider increasing timeout value.");
      console.error("Error:", error.message);
    } else {
      console.error("Other error:", error);
    }
  }
}

// ============================================================================
// 最佳实践
// ============================================================================

/**
 * 1. 为不同类型的操作设置合理的超时：
 *    - 普通 API 调用：5-10 秒
 *    - 文件上传/下载：30-60 秒
 *    - 批量处理：30-120 秒
 *
 * 2. 优先级使用：
 *    - 在客户端级别设置合理的默认值
 *    - 对特殊操作使用请求级别超时覆盖
 *
 * 3. 超时配置总结：
 *    - 方式 1: httpOptions.timeout（推荐用于通用配置）
 *    - 方式 2: requestHandler 构造函数（自定义 handler 时）
 *    - 方式 3: request.timeout（单个请求级别，优先级最高）
 */

export {
  clientWithTimeout,
  clientWithHandler,
  clientDefaultHandler,
  setRequestTimeout,
  addDynamicTimeoutMiddleware,
  handleRequestWithTimeout,
};
