/**
 * MiddlewareStack.merge() 测试 - 核心功能
 * 测试 Client 和 Command middleware 合并逻辑
 */

import { Client, Command } from "../../src/index";
import { MiddlewareStack } from "../../src/middlewares";
import { MockRequestHandler } from "../../src/testing/mock-request-handler";
import { MockClock } from "../../src/testing/mock-clock";

describe("MiddlewareStack.merge() - Core Features", () => {
  describe("Basic Merge", () => {
    test("should merge client and command middleware", async () => {
      const executionOrder: string[] = [];
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

      client.middlewareStack.add(
        (next) => async (args) => {
          executionOrder.push("client-middleware");
          return next(args);
        },
        { step: "initialize", name: "clientMiddleware", priority: 100 }
      );

      const command = new Command({ test: "data" });
      (command as any).requestConfig = {
        method: "POST",
        serviceName: "test-service",
        pathname: "/api/test",
        params: { Action: "TestAction", Version: "2023-01-01" },
      };

      command.middlewareStack.add(
        (next) => async (args) => {
          executionOrder.push("command-middleware");
          return next(args);
        },
        { step: "initialize", name: "commandMiddleware", priority: 150 }
      );

      await client.send(command);

      expect(executionOrder).toContain("client-middleware");
      expect(executionOrder).toContain("command-middleware");
      await client.destroy();
    });

    test("should execute in priority order", async () => {
      const executionOrder: string[] = [];
      const stack = new MiddlewareStack();

      stack.add(
        (next) => async (args) => {
          executionOrder.push("middleware-1");
          return next(args);
        },
        { step: "initialize", name: "middleware1", priority: 100 }
      );

      stack.add(
        (next) => async (args) => {
          executionOrder.push("middleware-2");
          return next(args);
        },
        { step: "initialize", name: "middleware2", priority: 200 }
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

      expect(executionOrder).toEqual([
        "middleware-2",
        "middleware-1",
        "handler",
      ]);
    });
  });

  describe("Empty Stack Handling", () => {
    test("should handle empty command middleware stack", async () => {
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

      client.middlewareStack.add(
        (next) => async (args) => {
          (args.request as any).custom = true;
          return next(args);
        },
        { step: "initialize", name: "clientMiddleware", priority: 100 }
      );

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
  });
});
