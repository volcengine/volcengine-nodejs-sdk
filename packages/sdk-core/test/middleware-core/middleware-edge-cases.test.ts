/**
 * Middleware Edge Cases - Core Tests
 * 核心边界情况测试
 */

import { Client, Command } from "../../src/index";
import { MiddlewareStack } from "../../src/middlewares";
import { MockRequestHandler } from "../../src/testing/mock-request-handler";
import { MockClock } from "../../src/testing/mock-clock";

describe("Middleware - Core Edge Cases", () => {
  describe("Empty Stack Handling", () => {
    test("should handle empty middleware stack", async () => {
      const mockHandler = new MockRequestHandler();
      const mockClock = new MockClock();

      mockHandler.mock("https://example.com/api/test", {
        status: 200,
        data: { result: "success" },
      });

      const client = new Client({
        host: "example.com",
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

      const result = await client.send(command);

      expect(result).toEqual({ result: "success" });
      await client.destroy();
    });

    test("should resolve empty middleware stack", async () => {
      const stack = new MiddlewareStack();
      const executionOrder: string[] = [];

      const handler = stack.resolve(
        async (args: any) => {
          executionOrder.push("final");
          return args;
        },
        {
          clientName: "MockClient",
          commandName: "MockCommand",
          clientConfig: {},
        }
      );

      const result = await handler({ request: {}, input: {} });

      expect(result).toBeDefined();
      expect(executionOrder).toEqual(["final"]);
    });
  });

  describe("Middleware Error Handling", () => {
    test("should propagate middleware errors", async () => {
      const mockHandler = new MockRequestHandler();
      const mockClock = new MockClock();

      const client = new Client({
        host: "example.com",
        requestHandler: mockHandler,
        clock: mockClock,
      });

      client.middlewareStack.add(
        (next) => async (args) => {
          throw new Error("Middleware error");
        },
        { step: "initialize", name: "errorMiddleware", priority: 200 }
      );

      mockHandler.mock("https://example.com/api/test", {
        status: 200,
        data: { result: "success" },
      });

      const command = new Command({ test: "data" });
      (command as any).requestConfig = {
        method: "POST",
        serviceName: "test-service",
        pathname: "/api/test",
        params: { Action: "TestAction", Version: "2023-01-01" },
      };

      await expect(client.send(command)).rejects.toThrow("Middleware error");
      expect(mockHandler.getRequestCount()).toBe(0);
      await client.destroy();
    });

    test("should handle middleware that does not call next", async () => {
      const mockHandler = new MockRequestHandler();
      const mockClock = new MockClock();

      const client = new Client({
        host: "example.com",
        requestHandler: mockHandler,
        clock: mockClock,
      });

      // Middleware that breaks the chain
      client.middlewareStack.add(
        (next) => async (args) => {
          return { broken: true }; // Does not call next()
        },
        { step: "initialize", name: "brokenMiddleware", priority: 200 }
      );

      mockHandler.mock("https://example.com/api/test", {
        status: 200,
        data: { result: "success" },
      });

      const command = new Command({ test: "data" });
      (command as any).requestConfig = {
        method: "POST",
        serviceName: "test-service",
        pathname: "/api/test",
        params: { Action: "TestAction", Version: "2023-01-01" },
      };

      const result = await client.send(command);

      expect(result).toEqual({ broken: true });
      expect(mockHandler.getRequestCount()).toBe(0); // Request never sent
      await client.destroy();
    });
  });

  describe("Priority Edge Cases", () => {
    test("should handle negative priority values", async () => {
      const executionOrder: string[] = [];
      const stack = new MiddlewareStack();

      stack.add(
        (next) => async (args) => {
          executionOrder.push("negative");
          return next(args);
        },
        { step: "initialize", name: "negative", priority: -50 }
      );

      stack.add(
        (next) => async (args) => {
          executionOrder.push("positive");
          return next(args);
        },
        { step: "initialize", name: "positive", priority: 50 }
      );

      const handler = stack.resolve(
        async (args) => {
          executionOrder.push("handler");
          return args;
        },
        {
          clientName: "MockClient",
          commandName: "MockCommand",
          clientConfig: {},
        }
      );

      await handler({ request: {}, input: {} });

      expect(executionOrder).toEqual(["positive", "negative", "handler"]);
    });

    test("should maintain insertion order for same priority", async () => {
      const executionOrder: string[] = [];
      const stack = new MiddlewareStack();

      for (let i = 1; i <= 5; i++) {
        stack.add(
          (next) => async (args) => {
            executionOrder.push(`mw${i}`);
            return next(args);
          },
          { step: "initialize", name: `mw${i}`, priority: 100 }
        );
      }

      const handler = stack.resolve(
        async (args) => {
          executionOrder.push("handler");
          return args;
        },
        {
          clientName: "MockClient",
          commandName: "MockCommand",
          clientConfig: {},
        }
      );

      await handler({ request: {}, input: {} });

      expect(executionOrder).toEqual([
        "mw1",
        "mw2",
        "mw3",
        "mw4",
        "mw5",
        "handler",
      ]);
    });
  });

  describe("Request Data Integrity", () => {
    test("should preserve request data through middleware chain", async () => {
      const mockHandler = new MockRequestHandler();
      const mockClock = new MockClock();

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

      const inputData = { test: "custom-payload", nested: { foo: "bar" } };
      const command = new Command(inputData);
      (command as any).requestConfig = {
        method: "POST",
        serviceName: "test-service",
        pathname: "/api/test",
        params: { Action: "TestAction", Version: "2023-01-01" },
      };

      await client.send(command);

      const lastRequest = mockHandler.getLastRequest();
      expect(lastRequest?.data).toEqual(inputData);
      await client.destroy();
    });
  });

  describe("Resource Cleanup", () => {
    test("should handle destroy() without errors", () => {
      const mockHandler = new MockRequestHandler();
      const mockClock = new MockClock();

      const client = new Client({
        host: "example.com",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        requestHandler: mockHandler,
        clock: mockClock,
      });

      expect(() => client.destroy()).not.toThrow();
    });
  });
});
