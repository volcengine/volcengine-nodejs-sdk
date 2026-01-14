/**
 * Retry logic tests
 * Tests for various retry scenarios including 5xx errors, network errors, etc.
 */

import { Client, Command } from "../src/index";
import { MockRequestHandler } from "../src/testing/mock-request-handler";
import { MockClock } from "../src/testing/mock-clock";
import { shouldRetry, calculateRetryDelay } from "../src/utils/retry";
import { StrategyName } from "../src/types/types";

describe("Retry Logic", () => {
  describe("Integration Tests", () => {
    test("should retry on 502 Bad Gateway error", async () => {
      // Arrange
      const mockClock = new MockClock();
      const mockHandler = new MockRequestHandler({ clock: mockClock });

      // Mock a 502 error response
      mockHandler.mock(/\/api\/test/, {
        status: 502,
        statusText: "Bad Gateway",
        data: { error: "Bad Gateway" },
        delayMs: 0, // No delay for faster tests
      });

      const client = new Client({
        host: "example.com",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        maxRetries: 3, // Retry 3 times (total 4 attempts)
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
        params: { Action: "BadGatewayAction", Version: "2023-01-01" },
      };

      // Act & Assert - Use longer timeout to allow retries to complete
      await expect(client.send(command)).rejects.toThrow(
        "HTTP 502: Bad Gateway"
      );

      // Wait to allow retries to process
      await new Promise((resolve) => setImmediate(resolve));

      // Verify that all 4 attempts were made
      expect(mockHandler.getRequestCount()).toBe(4);

      await client.destroy();
    });

    test("should retry on various 5xx errors", async () => {
      // Arrange
      const mockHandler = new MockRequestHandler();
      const mockClock = new MockClock();

      // Test different 5xx status codes
      const testCases = [
        { status: 500, statusText: "Internal Server Error" },
        { status: 502, statusText: "Bad Gateway" },
        { status: 503, statusText: "Service Unavailable" },
        { status: 504, statusText: "Gateway Timeout" },
      ];

      for (const testCase of testCases) {
        mockHandler.reset();

        mockHandler.mock(/\/api\/test/, {
          status: testCase.status,
          statusText: testCase.statusText,
          data: { error: testCase.statusText },
          delayMs: 10,
        });

        const client = new Client({
          host: "example.com",
          accessKeyId: "test-key",
          secretAccessKey: "test-secret",
          maxRetries: 3, // Retry 3 times (total 4 attempts)
          retryStrategy: {
            strategyName:
              StrategyName.ExponentialWithRandomJitterBackoffStrategy,
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
        await expect(client.send(command)).rejects.toThrow(
          `HTTP ${testCase.status}`
        );

        // Verify that retries were attempted
        expect(mockHandler.getRequestCount()).toBe(4);

        await client.destroy();
      }
    });

    test("should not retry on 4xx client errors (except 429)", async () => {
      // Arrange
      const mockHandler = new MockRequestHandler();
      const mockClock = new MockClock();

      // Test different 4xx status codes that should NOT be retried
      const testCases = [
        { status: 400, statusText: "Bad Request" },
        { status: 401, statusText: "Unauthorized" },
        { status: 403, statusText: "Forbidden" },
        { status: 404, statusText: "Not Found" },
      ];

      for (const testCase of testCases) {
        mockHandler.reset();

        mockHandler.mock(/\/api\/test/, {
          status: testCase.status,
          statusText: testCase.statusText,
          data: { error: testCase.statusText },
          delayMs: 10,
        });

        const client = new Client({
          host: "example.com",
          accessKeyId: "test-key",
          secretAccessKey: "test-secret",
          maxRetries: 2,
          retryStrategy: {
            strategyName:
              StrategyName.ExponentialWithRandomJitterBackoffStrategy,
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
        await expect(client.send(command)).rejects.toThrow(
          `HTTP ${testCase.status}`
        );

        // Verify that NO retries were attempted (only 1 request)
        expect(mockHandler.getRequestCount()).toBe(1);

        await client.destroy();
      }
    });

    test("should retry on 429 Too Many Requests", async () => {
      // Arrange
      const mockHandler = new MockRequestHandler();
      const mockClock = new MockClock();

      // Test 429 and 408 status codes that SHOULD be retried
      const testCases = [{ status: 429, statusText: "Too Many Requests" }];

      for (const testCase of testCases) {
        mockHandler.reset();

        mockHandler.mock(/\/api\/test/, {
          status: testCase.status,
          statusText: testCase.statusText,
          data: { error: testCase.statusText },
          delayMs: 10,
        });

        const client = new Client({
          host: "example.com",
          accessKeyId: "test-key",
          secretAccessKey: "test-secret",
          maxRetries: 2,
          retryStrategy: {
            strategyName:
              StrategyName.ExponentialWithRandomJitterBackoffStrategy,
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
        await expect(client.send(command)).rejects.toThrow(
          `HTTP ${testCase.status}`
        );

        // Verify that retries were attempted
        expect(mockHandler.getRequestCount()).toBe(3);

        await client.destroy();
      }
    });

    test("should retry on network errors", async () => {
      // Arrange
      const mockClock = new MockClock();
      const mockHandler = new MockRequestHandler({ clock: mockClock });

      // Create a handler that throws network errors
      mockHandler.request = async (config) => {
        // Record the request first
        (mockHandler as any).requests.push(config);

        // Simulate network error
        const error: any = new Error("connect ECONNREFUSED 127.0.0.1:443");
        error.code = "ECONNREFUSED";
        error.errno = "ECONNREFUSED";
        error.syscall = "connect";
        throw error;
      };

      const client = new Client({
        host: "example.com",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        maxRetries: 2,
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

      // Act & Assert
      await expect(client.send(command)).rejects.toThrow(
        "connect ECONNREFUSED"
      );

      // Wait to allow retries to process
      await new Promise((resolve) => setImmediate(resolve));

      // Verify that all 3 attempts were made
      expect(mockHandler.getRequestCount()).toBe(3);

      await client.destroy();
    });

    test("should use exponential backoff for retry delays", async () => {
      // Arrange
      const mockHandler = new MockRequestHandler();
      const mockClock = new MockClock();
      const delays: number[] = [];

      // Track clock sleep calls to verify delays
      const originalSleep = mockClock.sleep.bind(mockClock);
      mockClock.sleep = async (ms: number) => {
        delays.push(ms);
        return originalSleep(ms);
      };

      mockHandler.mock(/\/api\/test/, {
        status: 503,
        statusText: "Service Unavailable",
        data: { error: "Service Unavailable" },
        delayMs: 10,
      });

      const client = new Client({
        host: "example.com",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        maxRetries: 3, // 4 attempts = 3 retries
        retryStrategy: {
          strategyName: StrategyName.ExponentialWithRandomJitterBackoffStrategy,
          minRetryDelay: 100,
          maxRetryDelay: 20000,
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
      await expect(client.send(command)).rejects.toThrow("HTTP 503");

      // Verify that retries were attempted with delays
      expect(mockHandler.getRequestCount()).toBe(4);

      // Verify exponential backoff (with jitter, approximate)
      expect(delays.length).toBe(3); // 3 retries = 3 delays
      // Default strategy params: min 100, max 20000
      // Attempt 1: min(100 * 2^0, 20000) = 100. With Jitter: 100 + rand(100) -> 100-200
      expect(delays[0]).toBeGreaterThanOrEqual(100);
      expect(delays[0]).toBeLessThanOrEqual(200);
      // Attempt 2: min(100 * 2^1, 20000) = 200. With Jitter: 200 + rand(200) -> 200-400
      expect(delays[1]).toBeGreaterThanOrEqual(200);
      expect(delays[1]).toBeLessThanOrEqual(400);
      // Attempt 3: min(100 * 2^2, 20000) = 400. With Jitter: 400 + rand(400) -> 400-800
      expect(delays[2]).toBeGreaterThanOrEqual(400);
      expect(delays[2]).toBeLessThanOrEqual(800);

      await client.destroy();
    });

    test("should respect custom retry strategy", async () => {
      // Arrange
      const mockHandler = new MockRequestHandler();
      const mockClock = new MockClock();

      mockHandler.mock(/\/api\/test/, {
        status: 503,
        statusText: "Service Unavailable",
        data: { error: "Service Unavailable" },
        delayMs: 10,
      });

      const customRetryStrategy = {
        retryIf: (error: any) => {
          // Custom logic: only retry on 503, not other 5xx errors
          const status = error.status || error.response?.status;
          return status === 503;
        },
        delay: (attemptNumber: number) => {
          // Custom delay: fixed 500ms per retry
          return 500;
        },
      };

      const client = new Client({
        host: "example.com",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        maxRetries: 2,
        retryStrategy: customRetryStrategy,
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
      await expect(client.send(command)).rejects.toThrow("HTTP 503");

      // Verify that all 3 attempts were made
      expect(mockHandler.getRequestCount()).toBe(3);

      await client.destroy();
    });
  });

  describe("Retry behavior by HTTP method", () => {
    test("POST without maxRetries should retry by default", async () => {
      const mockClock = new MockClock();
      const mockHandler = new MockRequestHandler({ clock: mockClock });
      mockHandler.mock(/\/api\/post/, {
        status: 500,
        statusText: "Internal Server Error",
        data: { error: "Server error" },
        delayMs: 0,
      });

      const client = new Client({
        host: "example.com",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        requestHandler: mockHandler,
        clock: mockClock,
        retryStrategy: {
          strategyName: StrategyName.ExponentialBackoffStrategy,
        },
      });

      const command = new Command({ test: "data" });
      (command as any).requestConfig = {
        method: "POST",
        serviceName: "test-service",
        pathname: "/api/post",
        params: { Action: "PostAction", Version: "2023-01-01" },
      };

      await expect(client.send(command)).rejects.toThrow(
        "HTTP 500: Internal Server Error"
      );
      expect(mockHandler.getRequestCount()).toBe(4);
      await client.destroy();
    });

    test("PATCH without maxRetries should retry by default", async () => {
      const mockClock = new MockClock();
      const mockHandler = new MockRequestHandler({ clock: mockClock });
      mockHandler.mock(/\/api\/patch/, {
        status: 500,
        statusText: "Internal Server Error",
        data: { error: "Server error" },
        delayMs: 0,
      });

      const client = new Client({
        host: "example.com",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        requestHandler: mockHandler,
        clock: mockClock,
        retryStrategy: {
          strategyName: StrategyName.ExponentialBackoffStrategy,
        },
      });

      const command = new Command({ test: "data" });
      (command as any).requestConfig = {
        method: "PATCH",
        serviceName: "test-service",
        pathname: "/api/patch",
        params: { Action: "PatchAction", Version: "2023-01-01" },
      };

      await expect(client.send(command)).rejects.toThrow(
        "HTTP 500: Internal Server Error"
      );
      expect(mockHandler.getRequestCount()).toBe(4);
      await client.destroy();
    });

    test("GET without maxRetries should retry by default", async () => {
      const mockClock = new MockClock();
      const mockHandler = new MockRequestHandler({ clock: mockClock });
      mockHandler.mock(/\/api\/get/, {
        status: 500,
        statusText: "Internal Server Error",
        data: { error: "Server error" },
        delayMs: 0,
      });

      const client = new Client({
        host: "example.com",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        requestHandler: mockHandler,
        clock: mockClock,
        retryStrategy: {
          strategyName: StrategyName.ExponentialBackoffStrategy,
        },
      });

      const command = new Command({});
      (command as any).requestConfig = {
        method: "GET",
        serviceName: "test-service",
        pathname: "/api/get",
        params: { Action: "GetAction", Version: "2023-01-01" },
      };

      await expect(client.send(command)).rejects.toThrow(
        "HTTP 500: Internal Server Error"
      );
      expect(mockHandler.getRequestCount()).toBe(4);
      await client.destroy();
    });

    test("maxRetries=0 should disable retry (only one request)", async () => {
      const mockClock = new MockClock();
      const mockHandler = new MockRequestHandler({ clock: mockClock });
      mockHandler.mock(/\/api\/no-retry/, {
        status: 500,
        statusText: "Internal Server Error",
        data: { error: "Server error" },
        delayMs: 0,
      });

      const client = new Client({
        host: "example.com",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        maxRetries: 0,
        requestHandler: mockHandler,
        clock: mockClock,
        retryStrategy: {
          strategyName: StrategyName.ExponentialBackoffStrategy,
        },
      });

      const command = new Command({ test: "data" });
      (command as any).requestConfig = {
        method: "POST",
        serviceName: "test-service",
        pathname: "/api/no-retry",
        params: { Action: "NoRetryAction", Version: "2023-01-01" },
      };

      await expect(client.send(command)).rejects.toThrow(
        "HTTP 500: Internal Server Error"
      );
      expect(mockHandler.getRequestCount()).toBe(1);
      await client.destroy();
    });

    test("POST with maxRetries should retry", async () => {
      const mockClock = new MockClock();
      const mockHandler = new MockRequestHandler({ clock: mockClock });
      mockHandler.mock(/\/api\/post-with-max/, {
        status: 500,
        statusText: "Internal Server Error",
        data: { error: "Server error" },
        delayMs: 0,
      });

      const client = new Client({
        host: "example.com",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        maxRetries: 4,
        requestHandler: mockHandler,
        clock: mockClock,
        retryStrategy: {
          strategyName: StrategyName.ExponentialBackoffStrategy,
        },
      });

      const command = new Command({ test: "data" });
      (command as any).requestConfig = {
        method: "POST",
        serviceName: "test-service",
        pathname: "/api/post-with-max",
        params: { Action: "PostWithMax", Version: "2023-01-01" },
      };

      await expect(client.send(command)).rejects.toThrow(
        "HTTP 500: Internal Server Error"
      );
      expect(mockHandler.getRequestCount()).toBe(5);
      await client.destroy();
    });
  });

  describe("Unit Tests: shouldRetry", () => {
    test("should return true for network errors", () => {
      const networkErrors = [
        { code: "ECONNRESET" },
        { code: "ETIMEDOUT" },
        { code: "ECONNABORTED" },
        { code: "ECONNREFUSED" },
        { code: "ENOTFOUND" },
        { code: "EPIPE" },
      ];

      networkErrors.forEach((error) => {
        expect(shouldRetry(error)).toBe(true);
      });
    });

    test("should return true for 5xx and 429 status codes", () => {
      const statusErrors = [
        { status: 500 },
        { status: 502 },
        { status: 503 },
        { status: 504 },
        { status: 429 },
      ];

      statusErrors.forEach((error) => {
        expect(shouldRetry(error)).toBe(true);
      });
    });

    test("should return true when status is in response object", () => {
      const error = { response: { status: 502 } };
      expect(shouldRetry(error)).toBe(true);
    });

    test("should return false for other errors", () => {
      const errors = [
        { status: 400 },
        { status: 404 },
        { status: 401 },
        { message: "Some other error" },
      ];

      errors.forEach((error) => {
        expect(shouldRetry(error)).toBe(false);
      });
    });
  });

  describe("Unit Tests: calculateRetryDelay", () => {
    const defaultStrategy = { minRetryDelay: 100, maxRetryDelay: 20000 };

    test("NoBackoffStrategy returns 0", () => {
      const delay = calculateRetryDelay(1, {
        strategyName: StrategyName.NoBackoffStrategy,
      });
      expect(delay).toBe(0);
    });

    test("ExponentialBackoffStrategy returns correct delay", () => {
      // Formula: min(min * 2^(n-1), max)
      // min=100, max=20000
      // 1: 100 * 1 = 100
      // 2: 100 * 2 = 200
      // 3: 100 * 4 = 400
      expect(
        calculateRetryDelay(1, {
          strategyName: StrategyName.ExponentialBackoffStrategy,
          ...defaultStrategy,
        })
      ).toBe(100);
      expect(
        calculateRetryDelay(2, {
          strategyName: StrategyName.ExponentialBackoffStrategy,
          ...defaultStrategy,
        })
      ).toBe(200);
      expect(
        calculateRetryDelay(3, {
          strategyName: StrategyName.ExponentialBackoffStrategy,
          ...defaultStrategy,
        })
      ).toBe(400);
    });

    test("ExponentialBackoffStrategy caps at maxRetryDelay", () => {
      const strategy = { minRetryDelay: 100, maxRetryDelay: 300 };
      // 3: 100 * 4 = 400 > 300 -> 300
      expect(
        calculateRetryDelay(3, {
          strategyName: StrategyName.ExponentialBackoffStrategy,
          ...strategy,
        })
      ).toBe(300);
    });

    test("ExponentialWithRandomJitterBackoffStrategy returns delay within range", () => {
      // Formula: base = min(min * 2^(n-1), max)
      // delay = base + random(0, base) -> [base, 2*base)
      const delay = calculateRetryDelay(1, {
        strategyName: StrategyName.ExponentialWithRandomJitterBackoffStrategy,
        ...defaultStrategy,
      });
      // base = 100. delay in [100, 200)
      expect(delay).toBeGreaterThanOrEqual(100);
      expect(delay).toBeLessThan(200);
    });

    test("ExponentialWithRandomJitterBackoffStrategy caps at maxRetryDelay", () => {
      const strategy = { minRetryDelay: 300, maxRetryDelay: 300 };
      // base = min(300 * 2^2, 300) = 300
      // jitter = 300 + random(0, 300) -> [300, 600)
      // capped at maxRetryDelay = 300
      const delay = calculateRetryDelay(3, {
        strategyName: StrategyName.ExponentialWithRandomJitterBackoffStrategy,
        ...strategy,
      });
      expect(delay).toBe(300);
    });

    test("Default minRetryDelay is 300ms", () => {
      // Should use default min=300 when no strategy provided
      const delay = calculateRetryDelay(1, {
        strategyName: StrategyName.ExponentialBackoffStrategy,
      });
      expect(delay).toBe(300);
    });

    test("Default maxRetryDelay is 300s", () => {
      // Force a large attempt number to hit the cap
      // 300 * 2^20 is huge, should be capped at 300000
      const delay = calculateRetryDelay(20, {
        strategyName: StrategyName.ExponentialBackoffStrategy,
      });
      expect(delay).toBe(300000);
    });

    test("Default retryMode is ExponentialWithRandomJitterBackoffStrategy", () => {
      // If retryMode is undefined (though types say it is required in this function signature, but runtime might differ)
      // Actually the function signature in Client.ts was stricter, but the standalone function might be looser?
      // Checking implementation:
      /*
        if (retryMode === "NoBackoffStrategy") ...
        if (retryMode === "ExponentialBackoffStrategy") ...
        // Default to ExponentialWithRandomJitterBackoffStrategy
      */

      // We need to mock Math.random to verify jitter
      const originalRandom = Math.random;
      Math.random = () => 0.5;

      try {
        // Pass a mode that falls through to default
        const delay = calculateRetryDelay(1, "UnknownMode" as any);
        // base = 300 (default min)
        // delay = 300 + 0.5 * 300 = 450
        // capped at 300000
        expect(delay).toBe(450);
      } finally {
        Math.random = originalRandom;
      }
    });
  });

  describe("Unit Tests: Retry Middleware Logic", () => {
    test("should disable retry when autoRetry is false", async () => {
      const mockHandler = new MockRequestHandler();
      const mockClock = new MockClock();
      mockHandler.mock(/\/api\/test/, { status: 500 });

      const client = new Client({
        autoRetry: false,
        requestHandler: mockHandler,
        clock: mockClock,
        maxRetries: 2, // Should be ignored when autoRetry is false
      });

      const command = new Command({});
      (command as any).requestConfig = { method: "GET", pathname: "/api/test" };

      await expect(client.send(command)).rejects.toThrow();
      expect(mockHandler.getRequestCount()).toBe(1);
    });

    test("should use maxRetries from config", async () => {
      const mockHandler = new MockRequestHandler();
      const mockClock = new MockClock();
      mockHandler.mock(/\/api\/test/, { status: 500 });

      const client = new Client({
        maxRetries: 1,
        requestHandler: mockHandler,
        clock: mockClock,
      });

      const command = new Command({});
      (command as any).requestConfig = { method: "GET", pathname: "/api/test" };

      await expect(client.send(command)).rejects.toThrow();
      expect(mockHandler.getRequestCount()).toBe(2);
    });

    test("should default maxRetries to 3 (total 4 attempts)", async () => {
      const mockHandler = new MockRequestHandler();
      const mockClock = new MockClock();
      mockHandler.mock(/\/api\/test/, { status: 500 });

      const client = new Client({
        requestHandler: mockHandler,
        clock: mockClock,
      });

      const command = new Command({});
      (command as any).requestConfig = { method: "GET", pathname: "/api/test" };

      await expect(client.send(command)).rejects.toThrow();
      expect(mockHandler.getRequestCount()).toBe(4);
    });

    test("should use custom retryStrategy.retryIf if provided", async () => {
      const mockHandler = new MockRequestHandler();
      const mockClock = new MockClock();
      mockHandler.mock(/\/api\/test/, { status: 418 }); // Teapot

      const retryIf = jest.fn().mockReturnValue(true);
      const client = new Client({
        maxRetries: 1,
        retryStrategy: { retryIf },
        requestHandler: mockHandler,
        clock: mockClock,
      });

      const command = new Command({});
      (command as any).requestConfig = { method: "GET", pathname: "/api/test" };

      await expect(client.send(command)).rejects.toThrow();
      expect(mockHandler.getRequestCount()).toBe(2);
      expect(retryIf).toHaveBeenCalled();
    });

    test("should use custom retryStrategy.delay if provided", async () => {
      const mockHandler = new MockRequestHandler();
      const mockClock = new MockClock();
      mockHandler.mock(/\/api\/test/, { status: 500 });

      const delay = jest.fn().mockReturnValue(50);
      const client = new Client({
        maxRetries: 1,
        retryStrategy: { delay },
        requestHandler: mockHandler,
        clock: mockClock,
      });

      const originalSleep = mockClock.sleep.bind(mockClock);
      let sleptMs = 0;
      mockClock.sleep = async (ms) => {
        sleptMs = ms;
        return originalSleep(ms);
      };

      const command = new Command({});
      (command as any).requestConfig = { method: "GET", pathname: "/api/test" };

      await expect(client.send(command)).rejects.toThrow();
      expect(delay).toHaveBeenCalledWith(1);
      expect(sleptMs).toBe(50);
    });
  });
});
