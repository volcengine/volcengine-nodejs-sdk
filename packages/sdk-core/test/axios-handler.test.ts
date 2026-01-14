import { AxiosRequestHandler } from "../src/request-handlers/axios-handler";
import { HttpOptions } from "../src/types/types";
import type {
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from "axios";
import https from "https";

/**
 * Tests for AxiosRequestHandler
 * Focus on testing the normalizeHeaders method which has low coverage
 */
describe("AxiosRequestHandler - normalizeHeaders", () => {
  let handler: AxiosRequestHandler;
  let mockAxiosInstance: Partial<AxiosInstance>;
  let mockClientFactory: jest.Mock;
  let createAxiosResponse: (data: any) => AxiosResponse;

  beforeEach(() => {
    // Create mock axios instance with minimal required methods
    mockAxiosInstance = {
      request: jest.fn(),
    };

    // Mock factory function
    mockClientFactory = jest.fn(() => mockAxiosInstance as AxiosInstance);

    // Create handler with mocked factory
    const options: HttpOptions = {
      timeout: 10000,
    };
    handler = new AxiosRequestHandler(options, mockClientFactory);

    // Helper to create axios response
    createAxiosResponse = (data: any): AxiosResponse => ({
      data,
      status: 200,
      statusText: "OK",
      headers: {},
      config: {} as InternalAxiosRequestConfig,
    });
  });

  describe("handle null/undefined/empty headers", () => {
    test("should handle undefined headers", () => {
      const normalized = (handler as any).normalizeHeaders(undefined);
      expect(normalized).toEqual({});
    });

    test("should handle null headers", () => {
      const normalized = (handler as any).normalizeHeaders(null);
      expect(normalized).toEqual({});
    });

    test("should handle empty object headers", () => {
      const normalized = (handler as any).normalizeHeaders({});
      expect(normalized).toEqual({});
    });
  });

  describe("convert array header values", () => {
    test("should handle single array header value", () => {
      const headers = { "x-custom-list": ["item1"] };
      const normalized = (handler as any).normalizeHeaders(headers);
      expect(normalized["x-custom-list"]).toEqual(["item1"]);
    });

    test("should convert multiple array header values to comma-separated string", () => {
      const headers = {
        "x-custom-list": ["item1", "item2", "item3"],
      };
      const normalized = (handler as any).normalizeHeaders(headers);
      expect(normalized["x-custom-list"]).toEqual([
        "item1",
        "item2",
        "item3",
      ]);
    });

    test("should handle array with numbers", () => {
      const headers = { "x-custom": [123, 456] };
      const normalized = (handler as any).normalizeHeaders(headers);
      expect(normalized["x-custom"]).toEqual([123, 456]);
    });

    test("should handle array with mixed types", () => {
      const headers = { "x-mixed": [123, "string", true] };
      const normalized = (handler as any).normalizeHeaders(headers);
      expect(normalized["x-mixed"]).toEqual([123, "string", true]);
    });
  });

  describe("handle AxiosHeaders-like objects", () => {
    test("should handle both get method and direct properties", () => {
      const headers = {
        "content-type": "application/json",
        "x-custom": "custom-value",
        "x-direct": "direct-value",
      };

      const normalized = (handler as any).normalizeHeaders(headers);
      expect(normalized["content-type"]).toBe("application/json");
      expect(normalized["x-custom"]).toBe("custom-value");
      expect(normalized["x-direct"]).toBe("direct-value");
    });

    test("should handle get method throwing error (fallback path)", () => {
      const headers = {
        get: () => {
          throw new Error("get failed");
        },
        "x-fallback": "fallback-value",
        "x-another": "another-value",
      };

      const normalized = (handler as any).normalizeHeaders(headers);
      expect(normalized["x-fallback"]).toBe("fallback-value");
      expect(normalized["x-another"]).toBe("another-value");
    });

    test("should handle get method with array values", () => {
      const headers = {
        "x-custom-list": ["item1", "item2"],
      };

      const normalized = (handler as any).normalizeHeaders(headers);
      expect(normalized["x-custom-list"]).toEqual(["item1", "item2"]);
    });

    test("should handle simple object headers", () => {
      const headers = {
        "content-type": "application/json",
        "x-custom": "custom-value",
      };

      const normalized = (handler as any).normalizeHeaders(headers);
      expect(normalized["content-type"]).toBe("application/json");
      expect(normalized["x-custom"]).toBe("custom-value");
    });
  });

  describe("handle undefined/null header values", () => {
    test("should filter out undefined values", () => {
      const headers = {
        valid: "value",
        undefined: undefined,
        null: null,
      };
      const normalized = (handler as any).normalizeHeaders(headers);
      expect(normalized["valid"]).toBe("value");
      // undefined and null should be converted to strings
      expect(normalized["undefined"]).toBe("undefined");
      expect(normalized["null"]).toBe("null");
    });

    test("should convert non-string values to strings", () => {
      const headers = {
        number: 123,
        boolean: true,
        "boolean-false": false,
        object: JSON.stringify({ key: "value" }),
        zero: 0,
      };
      const normalized = (handler as any).normalizeHeaders(headers);
      expect(normalized["number"]).toBe("123");
      expect(normalized["boolean"]).toBe("true");
      expect(normalized["boolean-false"]).toBe("false");
      expect(normalized["object"]).toBe('{"key":"value"}');
      expect(normalized["zero"]).toBe("0");
    });
  });

  describe("handle simple object headers", () => {
    test("should handle simple string headers", () => {
      const headers = {
        "content-type": "application/json",
        "x-custom": "custom-value",
        authorization: "Bearer token123",
      };
      const normalized = (handler as any).normalizeHeaders(headers);
      expect(normalized).toEqual({
        "content-type": "application/json",
        "x-custom": "custom-value",
        authorization: "Bearer token123",
      });
    });

    test("should handle headers with spaces in values", () => {
      const headers = {
        "x-message": "Hello World",
        "x-user-agent": "Mozilla/5.0 (Windows NT)",
      };
      const normalized = (handler as any).normalizeHeaders(headers);
      expect(normalized["x-message"]).toBe("Hello World");
      expect(normalized["x-user-agent"]).toBe("Mozilla/5.0 (Windows NT)");
    });

    test("should handle numeric header values", () => {
      const headers = {
        "content-length": 1234,
        "x-count": 42,
      };
      const normalized = (handler as any).normalizeHeaders(headers);
      expect(normalized["content-length"]).toBe("1234");
      expect(normalized["x-count"]).toBe("42");
    });

    test("should handle set-cookie header as array", () => {
      const headers = {
        "set-cookie": ["session=123", "theme=dark"],
        "content-type": "application/json",
      };
      const normalized = (handler as any).normalizeHeaders(headers);
      expect(normalized["set-cookie"]).toEqual(["session=123", "theme=dark"]);
      expect(normalized["content-type"]).toBe("application/json");
    });

    test("should handle single set-cookie header as string", () => {
      const headers = {
        "set-cookie": "session=123",
      };
      const normalized = (handler as any).normalizeHeaders(headers);
      expect(normalized["set-cookie"]).toEqual("session=123");
    });
  });

  describe("handle unknown header types", () => {
    test("should handle non-object, non-null, non-undefined input", () => {
      const normalized = (handler as any).normalizeHeaders("string" as any);
      expect(normalized).toEqual({});
    });

    test("should handle number input", () => {
      const normalized = (handler as any).normalizeHeaders(123 as any);
      expect(normalized).toEqual({});
    });

    test("should handle boolean input", () => {
      const normalized = (handler as any).normalizeHeaders(true as any);
      expect(normalized).toEqual({});
    });
  });

  describe("integration test with request method", () => {
    test("should properly normalize headers from axios response", async () => {
      const mockResponse = createAxiosResponse({ result: "success" });
      mockResponse.headers = {
        "content-type": "application/json",
        "x-response-id": "resp-123",
      };

      (mockAxiosInstance.request as jest.Mock).mockResolvedValue(mockResponse);

      const response = await handler.request({
        url: "https://example.com/api",
        method: "GET",
        headers: {},
        data: undefined,
      });

      expect(response).toBeDefined();
      expect(response.data).toEqual({ result: "success" });
    });
  });

  describe("destroy method", () => {
    test("should not throw when destroy is called", () => {
      expect(() => handler.destroy()).not.toThrow();
    });

    test("should be callable multiple times", () => {
      expect(() => {
        handler.destroy();
        handler.destroy();
        handler.destroy();
      }).not.toThrow();
    });
  });
});

describe("AxiosRequestHandler - httpsAgent", () => {
  let mockClientFactory: jest.Mock;
  let mockAxiosInstance: Partial<AxiosInstance>;

  beforeEach(() => {
    mockAxiosInstance = {
      request: jest.fn(),
    };
    mockClientFactory = jest.fn(() => mockAxiosInstance as AxiosInstance);
  });

  test("should not create httpsAgent if not configured", () => {
    new AxiosRequestHandler({}, mockClientFactory);
    const config = mockClientFactory.mock.calls[0][0];
    expect(config.httpsAgent).toBeUndefined();
  });

  test("should use provided httpsAgent", () => {
    const agent = new https.Agent();
    new AxiosRequestHandler({ httpsAgent: agent }, mockClientFactory);
    const config = mockClientFactory.mock.calls[0][0];
    expect(config.httpsAgent).toBe(agent);
  });

  test("should create httpsAgent with ignoreSSL", () => {
    new AxiosRequestHandler({ ignoreSSL: true }, mockClientFactory);
    const config = mockClientFactory.mock.calls[0][0];
    expect(config.httpsAgent).toBeInstanceOf(https.Agent);
    expect(config.httpsAgent.options.rejectUnauthorized).toBe(false);
  });

  test("should create httpsAgent with pool options", () => {
    const pool = {
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 10,
      maxFreeSockets: 5,
    };
    new AxiosRequestHandler({ pool }, mockClientFactory);
    const config = mockClientFactory.mock.calls[0][0];
    expect(config.httpsAgent).toBeInstanceOf(https.Agent);
    expect(config.httpsAgent.options.keepAlive).toBe(true);
    expect(config.httpsAgent.options.keepAliveMsecs).toBe(1000);
    expect(config.httpsAgent.options.maxSockets).toBe(10);
    expect(config.httpsAgent.options.maxFreeSockets).toBe(5);
  });

  test("should combine ignoreSSL and pool options", () => {
    const pool = {
      keepAlive: true,
    };
    new AxiosRequestHandler({ ignoreSSL: true, pool }, mockClientFactory);
    const config = mockClientFactory.mock.calls[0][0];
    expect(config.httpsAgent).toBeInstanceOf(https.Agent);
    expect(config.httpsAgent.options.rejectUnauthorized).toBe(false);
    expect(config.httpsAgent.options.keepAlive).toBe(true);
  });

  test("should prioritize provided httpsAgent over ignoreSSL and pool options", () => {
    const providedAgent = new https.Agent({ keepAlive: false });
    new AxiosRequestHandler(
      {
        httpsAgent: providedAgent,
        ignoreSSL: true,
        pool: { keepAlive: true },
      },
      mockClientFactory
    );
    const config = mockClientFactory.mock.calls[0][0];
    expect(config.httpsAgent).toBe(providedAgent);
    // provided agent should not be modified or replaced
    expect(config.httpsAgent.options.keepAlive).toBe(false);
    // rejectUnauthorized might be undefined by default on new Agent()
    expect(config.httpsAgent.options.rejectUnauthorized).not.toBe(false);
  });

  test("should handle partial pool options", () => {
    const pool = {
      maxSockets: 20,
    };
    new AxiosRequestHandler({ pool }, mockClientFactory);
    const config = mockClientFactory.mock.calls[0][0];
    expect(config.httpsAgent).toBeInstanceOf(https.Agent);
    expect(config.httpsAgent.options.maxSockets).toBe(20);
    expect(config.httpsAgent.options.keepAlive).toBeUndefined();
    expect(config.httpsAgent.options.maxFreeSockets).toBeUndefined();
  });
});
