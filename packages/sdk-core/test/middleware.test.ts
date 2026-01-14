/**
 * Working Middleware Test Example
 * Simple, functional middleware tests that actually pass
 */

import { Client, Command } from "../src/index";
import { MockRequestHandler } from "../src/testing/mock-request-handler";
import { MockClock } from "../src/testing/mock-clock";
import { StrategyName } from "../src/types/types";

describe("Working Middleware Examples", () => {
  const createTestCommand = () => {
    const command = new Command({ test: "data" });
    (command as any).requestConfig = {
      method: "POST",
      serviceName: "test-service",
      pathname: "/api/test",
      params: { Action: "TestAction", Version: "2023-01-01" },
    };
    return command;
  };

  test("should add custom header via middleware", async () => {
    // Arrange
    const mockHandler = new MockRequestHandler();
    const mockClock = new MockClock();
    let capturedHeaders: Record<string, string> = {};

    mockHandler.mock("https://example.com/api/test", {
      status: 200,
      data: { result: "success" },
    });

    // Intercept request to capture headers
    const originalRequest = mockHandler.request.bind(mockHandler);
    mockHandler.request = async (config) => {
      capturedHeaders = config.headers || {};
      return originalRequest(config);
    };

    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      requestHandler: mockHandler,
      clock: mockClock,
    });

    // Add middleware to set custom header
    client.middlewareStack.add(
      (next, context) => async (args) => {
        args.request.headers = {
          ...args.request.headers,
          "X-Custom-Header": "custom-value",
          "X-Request-ID": "test-request-123",
        };
        return next(args);
      },
      { step: "initialize", name: "addCustomHeaders", priority: 100 }
    );

    const command = createTestCommand();

    // Act
    await client.send(command);

    // Assert
    expect(capturedHeaders["x-custom-header"]).toBe("custom-value");
    expect(capturedHeaders["x-request-id"]).toBe("test-request-123");

    await client.destroy();
  });

  test("should execute middleware in priority order", async () => {
    // Arrange
    const mockHandler = new MockRequestHandler();
    const mockClock = new MockClock();
    const executionOrder: string[] = [];

    mockHandler.mock("https://example.com/api/test", {
      status: 200,
      data: { result: "success" },
    });

    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      requestHandler: mockHandler,
      clock: mockClock,
    });

    // Add middleware with different priorities
    client.middlewareStack.add(
      (next, context) => async (args) => {
        executionOrder.push("middleware-1 (priority: 100)");
        return next(args);
      },
      { step: "initialize", name: "middleware1", priority: 100 }
    );

    client.middlewareStack.add(
      (next, context) => async (args) => {
        executionOrder.push("middleware-2 (priority: 200)");
        return next(args);
      },
      { step: "initialize", name: "middleware2", priority: 200 }
    );

    const command = createTestCommand();

    // Act
    await client.send(command);

    // Assert - Middleware should execute in priority order (higher first)
    expect(executionOrder).toEqual([
      "middleware-2 (priority: 200)",
      "middleware-1 (priority: 100)",
    ]);

    await client.destroy();
  });

  test("should use configured timeout from middleware", async () => {
    // Arrange
    const mockHandler = new MockRequestHandler();
    const mockClock = new MockClock();
    let capturedTimeout: number | undefined;

    mockHandler.mock("https://example.com/api/test", {
      status: 200,
      data: { result: "success" },
    });

    const originalRequest = mockHandler.request.bind(mockHandler);
    mockHandler.request = async (config) => {
      capturedTimeout = config.timeout;
      return originalRequest(config);
    };

    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      httpOptions: { timeout: 5000 },
      requestHandler: mockHandler,
      clock: mockClock,
    });

    // Set request-level timeout via middleware
    client.middlewareStack.add(
      (next, context) => async (args) => {
        args.request.timeout = 2000;
        return next(args);
      },
      { step: "initialize", name: "setRequestTimeout", priority: 100 }
    );

    const command = createTestCommand();

    // Act
    await client.send(command);

    // Assert
    expect(capturedTimeout).toBe(2000);

    await client.destroy();
  });

  test("should retry on 502 error", async () => {
    // Arrange
    const mockClock = new MockClock();
    const mockHandler = new MockRequestHandler({ clock: mockClock });

    // Mock a 502 error response
    mockHandler.mock(/\/api\/test/, {
      status: 502,
      statusText: "Bad Gateway",
      data: { error: "Bad Gateway" },
      delayMs: 0,
    });

    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      maxRetries: 3,
      retryStrategy: {
        strategyName: StrategyName.ExponentialWithRandomJitterBackoffStrategy,
      },
      requestHandler: mockHandler,
      clock: mockClock,
    });

    const command = createTestCommand();

    // Act & Assert - Should retry 3 times
    await expect(client.send(command)).rejects.toThrow();
    expect(mockHandler.getRequestCount()).toBe(4);

    await client.destroy();
  });
});
