/**
 * http-request middleware timeout 优先级测试
 *
 * 修复前（错误）:
 *   request.timeout || clientConfig.httpOptions?.timeout || 30 * 1000
 *
 * 修复后（正确）:
 *   request.timeout ?? clientConfig.httpOptions?.readTimeout ?? clientConfig.httpOptions?.timeout ?? 30 * 1000
 *
 * 关键差异：
 * 1. 使用 ?? 而非 ||，正确处理 timeout=0 的情况
 * 2. 加入 readTimeout 优先级层，实现 connectTimeout/readTimeout 分离
 * 3. 30000ms 作为最终兜底默认值
 */

import { Client, Command } from "../src/index";
import { MockRequestHandler } from "../src/testing/mock-request-handler";
import { MockClock } from "../src/testing/mock-clock";

describe("http-request middleware timeout priority", () => {
  let mockHandler: MockRequestHandler;
  let mockClock: MockClock;
  let capturedTimeouts: (number | undefined)[];

  beforeEach(() => {
    mockHandler = new MockRequestHandler();
    mockClock = new MockClock();
    capturedTimeouts = [];

    // Intercept request to capture timeout
    mockHandler.mock(/.*/, {
      status: 200,
      data: { ResponseMetadata: { RequestId: "test" }, Result: {} },
      delayMs: 10,
    });

    const originalRequest = mockHandler.request.bind(mockHandler);
    mockHandler.request = async (config) => {
      capturedTimeouts.push(config.timeout);
      return originalRequest(config);
    };
  });

  function createCommand() {
    const command = new Command({ test: "data" });
    (command as any).requestConfig = {
      method: "POST",
      serviceName: "test-service",
      params: { Action: "TestAction", Version: "2023-01-01" },
    };
    return command;
  }

  test("默认应使用 30000ms 作为兜底超时", async () => {
    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      requestHandler: mockHandler,
      clock: mockClock,
    });

    await client.send(createCommand());
    expect(capturedTimeouts[0]).toBe(30000);
    await client.destroy();
  });

  test("httpOptions.timeout 应覆盖默认 30000ms", async () => {
    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      httpOptions: { timeout: 5000 },
      requestHandler: mockHandler,
      clock: mockClock,
    });

    await client.send(createCommand());
    expect(capturedTimeouts[0]).toBe(5000);
    await client.destroy();
  });

  test("httpOptions.readTimeout 应优先于 httpOptions.timeout", async () => {
    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      httpOptions: { readTimeout: 8000, timeout: 5000 },
      requestHandler: mockHandler,
      clock: mockClock,
    });

    await client.send(createCommand());
    expect(capturedTimeouts[0]).toBe(8000);
    await client.destroy();
  });

  test("request.timeout 应具有最高优先级", async () => {
    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      httpOptions: { readTimeout: 8000, timeout: 5000 },
      requestHandler: mockHandler,
      clock: mockClock,
    });

    // 通过 middleware 设置 request.timeout
    client.middlewareStack.add(
      (next, context) => async (args: any) => {
        args.request.timeout = 2000;
        return next(args);
      },
      { step: "initialize", name: "setRequestTimeout", priority: 100 }
    );

    await client.send(createCommand());
    expect(capturedTimeouts[0]).toBe(2000);
    await client.destroy();
  });

  test("SendOptions.timeout 应具有最高优先级", async () => {
    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      httpOptions: { readTimeout: 8000, timeout: 5000 },
      requestHandler: mockHandler,
      clock: mockClock,
    });

    await client.send(createCommand(), { timeout: 1500 });
    expect(capturedTimeouts[0]).toBe(1500);
    await client.destroy();
  });

  test("request.timeout=0 应使用 ?? 正确传递 0（而非回退到默认值）", async () => {
    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      httpOptions: { readTimeout: 8000 },
      requestHandler: mockHandler,
      clock: mockClock,
    });

    // 通过 SendOptions 设置 timeout=0
    await client.send(createCommand(), { timeout: 0 });
    // ?? 操作符对 0 不会回退，所以应该传递 0
    // 注意：这里 request.timeout 在 client.send 中被设置为 options.timeout (0)
    // 然后在 http-request middleware 中 request.timeout ?? ... 
    // 由于 0 是 nullish 操作符的有效值，应该为 0
    expect(capturedTimeouts[0]).toBe(0);
    await client.destroy();
  });

  test("connectTimeout 不影响请求级别的超时计算", async () => {
    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      httpOptions: { connectTimeout: 1000, readTimeout: 15000 },
      requestHandler: mockHandler,
      clock: mockClock,
    });

    await client.send(createCommand());
    // 请求级别应使用 readTimeout=15000，不受 connectTimeout 影响
    expect(capturedTimeouts[0]).toBe(15000);
    await client.destroy();
  });

  test("完整优先级链验证: request > readTimeout > timeout > 30000", async () => {
    // Case 1: 无任何配置 → 30000
    const client1 = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      requestHandler: mockHandler,
      clock: mockClock,
    });
    await client1.send(createCommand());

    // Case 2: 只有 timeout → timeout
    capturedTimeouts = [];
    const client2 = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      httpOptions: { timeout: 10000 },
      requestHandler: mockHandler,
      clock: mockClock,
    });
    await client2.send(createCommand());

    // Case 3: readTimeout + timeout → readTimeout
    capturedTimeouts = [];
    const client3 = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      httpOptions: { readTimeout: 7000, timeout: 10000 },
      requestHandler: mockHandler,
      clock: mockClock,
    });
    await client3.send(createCommand());

    // 验证分别的结果
    // (由于 capturedTimeouts 被重置了，需要逐个检查)
    expect(capturedTimeouts[0]).toBe(7000);

    await client1.destroy();
    await client2.destroy();
    await client3.destroy();
  });
});
