import { createHttpRequestMiddleware } from "../src/middlewares/http-request";
import { HttpRequestError } from "../src/types/http-request-error";

describe("createHttpRequestMiddleware Error Handling", () => {
  const mockNext = jest.fn();
  const mockContext = {
    clientConfig: {},
    clientName: "TestClient",
    commandName: "TestCommand",
  };
  const mockRequest = {
    protocol: "https",
    host: "example.com",
    pathname: "/",
    method: "GET",
    headers: {},
  };
  const mockArgs = { request: mockRequest };

  const networkErrorCodes = [
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ECONNRESET",
    "ENOTFOUND",
    "EHOSTUNREACH",
    "EAI_AGAIN",
    "EPROTO",
    "ECONNABORTED",
    "ENETUNREACH",
    "EPIPE",
  ];

  const sslErrorCodes = [
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "CERT_HAS_EXPIRED",
    "DEPTH_ZERO_SELF_SIGNED_CERT",
    "ERR_TLS_CERT_ALTNAME_INVALID",
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  networkErrorCodes.forEach((code) => {
    test(`should throw NetworkError for ${code}`, async () => {
      const error = new Error(`Error with code ${code}`);
      (error as any).code = code;

      const requestHandler = {
        request: jest.fn().mockRejectedValue(error),
      };

      const { middleware } = createHttpRequestMiddleware(requestHandler as any);
      const handler = middleware(mockNext, mockContext);

      try {
        await handler(mockArgs as any);
        throw new Error("Should have thrown error");
      } catch (e: any) {
        if (e.message === "Should have thrown error") throw e;
        expect(e).toBeInstanceOf(HttpRequestError);
        expect(e.name).toBe("NetworkError");
        expect(e.message).toContain("Network error");
        expect(e.originalError).toBe(error);
      }
    });
  });

  sslErrorCodes.forEach((code) => {
    test(`should throw ApiException for SSL error ${code}`, async () => {
      const error = new Error(`SSL Error with code ${code}`);
      (error as any).code = code;

      const requestHandler = {
        request: jest.fn().mockRejectedValue(error),
      };

      const { middleware } = createHttpRequestMiddleware(requestHandler as any);
      const handler = middleware(mockNext, mockContext);

      try {
        await handler(mockArgs as any);
        throw new Error("Should have thrown error");
      } catch (e: any) {
        if (e.message === "Should have thrown error") throw e;
        expect(e).toBeInstanceOf(HttpRequestError);
        expect(e.name).toBe("ApiException");
        expect(e.message).toContain("SSL Error");
        expect(e.originalError).toBe(error);
      }
    });
  });

  test("should throw NetworkError for timeout message", async () => {
    const error = new Error("Connection timeout");

    const requestHandler = {
      request: jest.fn().mockRejectedValue(error),
    };

    const { middleware } = createHttpRequestMiddleware(requestHandler as any);
    const handler = middleware(mockNext, mockContext);

    try {
      await handler(mockArgs as any);
      throw new Error("Should have thrown error");
    } catch (e: any) {
      if (e.message === "Should have thrown error") throw e;
      expect(e).toBeInstanceOf(HttpRequestError);
      expect(e.name).toBe("NetworkError");
    }
  });

  test("should throw Exception for generic error", async () => {
    const error = new Error("Something went wrong");

    const requestHandler = {
      request: jest.fn().mockRejectedValue(error),
    };

    const { middleware } = createHttpRequestMiddleware(requestHandler as any);
    const handler = middleware(mockNext, mockContext);

    try {
      await handler(mockArgs as any);
      throw new Error("Should have thrown error");
    } catch (e: any) {
      if (e.message === "Should have thrown error") throw e;
      expect(e).toBeInstanceOf(HttpRequestError);
      expect(e.name).toBe("Exception");
      expect(e.message).toContain("HTTP request failed");
    }
  });
});
