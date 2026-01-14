import { Client, Command } from "../src/index";
import { MockRequestHandler } from "../src/testing/mock-request-handler";
import { MockClock } from "../src/testing/mock-clock";
import { StrategyName } from "../src/types/types";

describe("Timeout Configuration", () => {
  test("should use default timeout (30000ms) when no timeout is configured", async () => {
    // Arrange
    const mockHandler = new MockRequestHandler();
    const mockClock = new MockClock();
    let capturedTimeout: number | undefined;

    mockHandler.mock("https://example.com/api/test", {
      status: 200,
      data: { result: "success" },
      delayMs: 100,
    });

    // Wrap the handler to capture the timeout value
    const originalRequest = mockHandler.request.bind(mockHandler);
    mockHandler.request = async (config) => {
      capturedTimeout = config.timeout;
      return originalRequest(config);
    };

    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      requestHandler: mockHandler,
      clock: mockClock,
    });

    const command = new Command({ test: "data" });
    (command as any).requestConfig = {
      method: "POST",
      serviceName: "test-service",
      params: { Action: "TestAction", Version: "2023-01-01" },
    };

    // Act
    await client.send(command);

    // Assert
    expect(capturedTimeout).toBe(30000); // Default timeout

    await client.destroy();
  });

  test("should use httpOptions.timeout when configured", async () => {
    // Arrange
    const mockHandler = new MockRequestHandler();
    const mockClock = new MockClock();
    let capturedTimeout: number | undefined;

    mockHandler.mock("https://example.com/api/test", {
      status: 200,
      data: { result: "success" },
      delayMs: 50,
    });

    // Wrap the handler to capture the timeout value
    const originalRequest = mockHandler.request.bind(mockHandler);
    mockHandler.request = async (config) => {
      capturedTimeout = config.timeout;
      return originalRequest(config);
    };

    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      httpOptions: {
        timeout: 5000,
      },
      requestHandler: mockHandler,
      clock: mockClock,
    });

    const command = new Command({ test: "data" });
    (command as any).requestConfig = {
      method: "POST",
      serviceName: "test-service",
      params: { Action: "TestAction", Version: "2023-01-01" },
    };

    // Act
    await client.send(command);

    // Assert
    expect(capturedTimeout).toBe(5000); // Client-level timeout

    await client.destroy();
  });

  test("should use request.timeout when configured (overrides httpOptions)", async () => {
    // Arrange
    const mockHandler = new MockRequestHandler();
    const mockClock = new MockClock();
    let capturedTimeout: number | undefined;

    mockHandler.mock("https://example.com/api/test", {
      status: 200,
      data: { result: "success" },
      delayMs: 50,
    });

    // Wrap the handler to capture the timeout value
    const originalRequest = mockHandler.request.bind(mockHandler);
    mockHandler.request = async (config) => {
      capturedTimeout = config.timeout;
      return originalRequest(config);
    };

    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      httpOptions: {
        timeout: 5000, // This should be overridden
      },
      requestHandler: mockHandler,
      clock: mockClock,
    });

    const command = new Command({ test: "data" });
    (command as any).requestConfig = {
      method: "POST",
      serviceName: "test-service",
      params: { Action: "TestAction", Version: "2023-01-01" },
    };

    // Act - set request-level timeout via middleware
    client.middlewareStack.add(
      (next, context) => async (args: any) => {
        args.request.timeout = 2000; // Request-level timeout
        return next(args);
      },
      { step: "initialize", name: "setRequestTimeout", priority: 100 }
    );

    await client.send(command);

    // Assert
    expect(capturedTimeout).toBe(2000); // Request-level timeout overrides client-level

    await client.destroy();
  });

  test("should allow different timeouts for different requests", async () => {
    // Arrange
    const mockHandler = new MockRequestHandler();
    const mockClock = new MockClock();
    const capturedTimeouts: number[] = [];

    mockHandler.mock("https://example.com/api/fast", {
      status: 200,
      data: { result: "fast" },
      delayMs: 50,
    });

    mockHandler.mock("https://example.com/api/slow", {
      status: 200,
      data: { result: "slow" },
      delayMs: 50,
    });

    // Wrap the handler to capture timeout values
    const originalRequest = mockHandler.request.bind(mockHandler);
    mockHandler.request = async (config) => {
      capturedTimeouts.push(config.timeout || 0);
      return originalRequest(config);
    };

    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      httpOptions: {
        timeout: 5000, // Default timeout for all requests
      },
      requestHandler: mockHandler,
      clock: mockClock,
    });

    // Act - First request with default timeout
    const fastCommand = new Command({});
    (fastCommand as any).requestConfig = {
      method: "GET",
      serviceName: "test-service",
      params: { Action: "FastAction", Version: "2023-01-01" },
    };
    await client.send(fastCommand);

    // Second request with custom timeout
    const slowCommand = new Command({});
    (slowCommand as any).requestConfig = {
      method: "GET",
      serviceName: "test-service",
      params: { Action: "SlowAction", Version: "2023-01-01" },
    };

    // Override timeout for this specific request
    client.middlewareStack.add(
      (next, context) => async (args: any) => {
        if (args.request.params?.Action === "SlowAction") {
          args.request.timeout = 10000; // Longer timeout for slow operation
        }
        return next(args);
      },
      { step: "initialize", name: "setCustomTimeout", priority: 100 }
    );

    await client.send(slowCommand);

    // Assert
    expect(capturedTimeouts).toHaveLength(2);
    expect(capturedTimeouts[0]).toBe(5000); // First request uses default
    expect(capturedTimeouts[1]).toBe(10000); // Second request uses custom timeout

    await client.destroy();
  });
});

describe("Timeout Behavior", () => {
  test("should timeout when response takes longer than configured timeout", async () => {
    // Arrange
    const mockHandler = new MockRequestHandler();
    const mockClock = new MockClock();

    // Mock response that takes 200ms (longer than 100ms timeout)
    mockHandler.mock(/\/api\/slow/, {
      status: 200,
      data: { result: "success" },
      delayMs: 200, // Response takes 200ms
    });

    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      httpOptions: {
        timeout: 100, // 100ms timeout
      },
      requestHandler: mockHandler,
      clock: mockClock,
    });

    const command = new Command({ test: "data" });
    (command as any).requestConfig = {
      method: "POST",
      serviceName: "test-service",
      pathname: "/api/slow",
      params: { Action: "SlowAction", Version: "2023-01-01" },
    };

    // Act & Assert
    await expect(client.send(command)).rejects.toThrow(
      "timeout of 100ms exceeded"
    );

    await client.destroy();
  });

  test("should not timeout when response is faster than configured timeout", async () => {
    // Arrange
    const mockHandler = new MockRequestHandler();
    const mockClock = new MockClock();

    // Mock response that takes 50ms (faster than 100ms timeout)
    mockHandler.mock(/\/api\/fast/, {
      status: 200,
      data: { result: "success" },
      delayMs: 50, // Response takes 50ms
    });

    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      httpOptions: {
        timeout: 100, // 100ms timeout
      },
      requestHandler: mockHandler,
      clock: mockClock,
    });

    const command = new Command({ test: "data" });
    (command as any).requestConfig = {
      method: "POST",
      serviceName: "test-service",
      pathname: "/api/fast",
      params: { Action: "FastAction", Version: "2023-01-01" },
    };

    // Act
    const result = await client.send(command);

    // Assert
    expect(result).toEqual({ result: "success" }); // Request succeeds

    await client.destroy();
  });

  test("should timeout at request-level timeout, not client-level", async () => {
    // Arrange
    const mockHandler = new MockRequestHandler();
    const mockClock = new MockClock();

    // Mock response that takes 150ms
    mockHandler.mock(/\/api\/test/, {
      status: 200,
      data: { result: "success" },
      delayMs: 150, // Response takes 150ms
    });

    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      httpOptions: {
        timeout: 5000, // Client-level: 5 seconds (should NOT timeout)
      },
      requestHandler: mockHandler,
      clock: mockClock,
    });

    const command = new Command({ test: "data" });
    (command as any).requestConfig = {
      method: "POST",
      serviceName: "test-service",
      pathname: "/api/test",
      params: { Action: "TestAction", Version: "2023-01-01" },
    };

    // Override with request-level timeout (100ms)
    client.middlewareStack.add(
      (next, context) => async (args: any) => {
        args.request.timeout = 100; // Request-level: 100ms (SHOULD timeout)
        return next(args);
      },
      { step: "initialize", name: "setRequestTimeout", priority: 100 }
    );

    // Act & Assert
    // Should timeout at 100ms (request-level), not 5000ms (client-level)
    await expect(client.send(command)).rejects.toThrow(
      "timeout of 100ms exceeded"
    );

    await client.destroy();
  });

  test("should use client-level timeout when no request-level timeout is set", async () => {
    // Arrange
    const mockHandler = new MockRequestHandler();
    const mockClock = new MockClock();

    // Mock response that takes 150ms
    mockHandler.mock(/\/api\/test/, {
      status: 200,
      data: { result: "success" },
      delayMs: 150, // Response takes 150ms
    });

    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      httpOptions: {
        timeout: 100, // Client-level: 100ms
      },
      requestHandler: mockHandler,
      clock: mockClock,
    });

    const command = new Command({ test: "data" });
    (command as any).requestConfig = {
      method: "POST",
      serviceName: "test-service",
      pathname: "/api/test",
      params: { Action: "TestAction", Version: "2023-01-01" },
    };

    // Act & Assert
    // Should timeout at 100ms (client-level)
    await expect(client.send(command)).rejects.toThrow(
      "timeout of 100ms exceeded"
    );

    await client.destroy();
  });

  test("should retry on timeout error when retry is enabled", async () => {
    // Arrange
    const mockHandler = new MockRequestHandler();
    const mockClock = new MockClock();

    // Mock response that always takes 150ms (longer than 100ms timeout)
    mockHandler.mock(/\/api\/test/, {
      status: 200,
      data: { result: "success" },
      delayMs: 150, // Always slower than timeout
    });

    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      httpOptions: {
        timeout: 100, // 100ms timeout
      },
      maxRetries: 2, // Retry 2 times (total 3 attempts)
      retryStrategy: {
        strategyName: StrategyName.ExponentialWithRandomJitterBackoffStrategy,
      },
      requestHandler: mockHandler,
      clock: mockClock,
    });

    const command = new Command({ test: "data" });
    (command as any).requestConfig = {
      method: "POST",
      serviceName: "test-service",
      pathname: "/api/test",
      params: { Action: "TestAction", Version: "2023-01-01" },
    };

    // Act & Assert - Should timeout but also retry
    try {
      await client.send(command);
      fail("Should have thrown timeout error");
    } catch (error: any) {
      expect(error.message).toContain("timeout of 100ms exceeded");
      // Verify that all 3 attempts were made
      expect(mockHandler.getRequestCount()).toBe(3);
    }

    await client.destroy();
  });
});
