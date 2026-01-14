/**
 * Built-in Middleware - Core Unit Tests
 * 测试内置 middleware 的核心功能
 */

import { Client, Command } from "../../src/index";
import { MockRequestHandler } from "../../src/testing/mock-request-handler";
import { MockClock } from "../../src/testing/mock-clock";

describe("Built-in Middleware - Core Features", () => {
  describe("signerMiddleware", () => {
    test("should sign request when credentials are provided", async () => {
      const mockHandler = new MockRequestHandler();
      const mockClock = new MockClock();

      mockHandler.mock("https://example.com/api/test", {
        status: 200,
        data: { result: "success" },
      });

      const client = new Client({
        host: "example.com",
        accessKeyId: "AK_TEST",
        secretAccessKey: "SK_TEST",
        region: "cn-beijing",
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

      await client.send(command);

      const lastRequest = mockHandler.getLastRequest();
      expect(lastRequest?.headers?.["Authorization"]).toBeDefined();
      expect(lastRequest?.headers?.["x-date"]).toBeDefined();
      await client.destroy();
    });

    test("should sign request without credentials,but env has credentials", async () => {
      const mockHandler = new MockRequestHandler();
      const mockClock = new MockClock();
      delete process.env.VOLCSTACK_ACCESS_KEY_ID;
      delete process.env.VOLCSTACK_SECRET_ACCESS_KEY;
      process.env.VOLCSTACK_ACCESS_KEY_ID = "AK_TEST";
      process.env.VOLCSTACK_SECRET_ACCESS_KEY = "SK_TEST";

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

      await client.send(command);

      const lastRequest = mockHandler.getLastRequest();
      expect(lastRequest?.headers?.["Authorization"]).toBeDefined();
      expect(lastRequest?.headers?.["x-date"]).toBeDefined();
      await client.destroy();
    });
  });

  describe("httpRequestMiddleware", () => {
    test("should construct correct URL with query parameters", async () => {
      const mockHandler = new MockRequestHandler();
      const mockClock = new MockClock();

      let capturedUrl: string = "";
      const originalRequest = mockHandler.request.bind(mockHandler);
      mockHandler.request = async (config) => {
        capturedUrl = config.url;
        return originalRequest(config);
      };

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

      const command = new Command({ test: "data" });
      (command as any).requestConfig = {
        method: "POST",
        serviceName: "test-service",
        pathname: "/api/test",
        params: {
          Action: "TestAction",
          Version: "2023-01-01",
          UserId: "12345",
        },
      };

      await client.send(command);

      expect(capturedUrl).toContain("Action=TestAction");
      expect(capturedUrl).toContain("Version=2023-01-01");
      expect(capturedUrl).toContain("UserId=12345");
      await client.destroy();
    });

    test("should POST request body for POST method", async () => {
      const mockHandler = new MockRequestHandler();
      const mockClock = new MockClock();

      let capturedData: any;
      const originalRequest = mockHandler.request.bind(mockHandler);
      mockHandler.request = async (config) => {
        capturedData = config.data;
        return originalRequest(config);
      };

      mockHandler.mock("https://example.com/api/test", {
        status: 200,
        data: { result: "success" },
      });

      const client = new Client({
        host: "example.com",
        requestHandler: mockHandler,
        clock: mockClock,
      });

      const inputData = { name: "Test", value: 42 };
      const command = new Command(inputData);
      (command as any).requestConfig = {
        method: "POST",
        serviceName: "test-service",
        pathname: "/api/test",
        params: { Action: "Create", Version: "2023-01-01" },
      };

      await client.send(command);

      expect(capturedData).toEqual(inputData);
      await client.destroy();
    });

    test("should not include body for GET method", async () => {
      const mockHandler = new MockRequestHandler();
      const mockClock = new MockClock();

      let capturedData: any;
      const originalRequest = mockHandler.request.bind(mockHandler);
      mockHandler.request = async (config) => {
        capturedData = config.data;
        return originalRequest(config);
      };

      mockHandler.mock("https://example.com/api/test", {
        status: 200,
        data: { result: "success" },
      });

      const client = new Client({
        host: "example.com",
        requestHandler: mockHandler,
        clock: mockClock,
      });

      const inputData = { id: 123 };
      const command = new Command(inputData);
      (command as any).requestConfig = {
        method: "GET",
        serviceName: "test-service",
        pathname: "/api/test",
        params: { Action: "Get", Version: "2023-01-01" },
      };

      await client.send(command);

      expect(capturedData).toBeUndefined();
      await client.destroy();
    });
  });
});
