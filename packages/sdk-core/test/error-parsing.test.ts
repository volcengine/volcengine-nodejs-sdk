import { createHttpRequestMiddleware } from "../src/middlewares/http-request";
import { MockRequestHandler } from "../src/testing/mock-request-handler";
import { HttpRequestError } from "../src/types/http-request-error";
import { MiddlewareContext } from "../src/middlewares/types";

describe("Error Parsing Logic", () => {
  it("should parse ResponseMetadata.Error when status is 400", async () => {
    const mockHandler = new MockRequestHandler();
    const responseData = {
      ResponseMetadata: {
        RequestId: "req-123",
        Action: "Test",
        Version: "1",
        Service: "test",
        Region: "cn-beijing",
        Error: {
          Code: "InvalidAction",
          Message: "The action is not supported",
        },
      },
    };

    mockHandler.mock("https://test.com/", {
      status: 400,
      data: responseData,
    });

    const { middleware } = createHttpRequestMiddleware(mockHandler);
    const next = jest.fn();
    const context: MiddlewareContext = {} as any;

    const handler = middleware(next, context);

    try {
      await handler({
        request: {
          host: "test.com",
          protocol: "https",
          path: "/",
        } as any,
        input: {},
      });
      throw new Error("Should have thrown HttpRequestError");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpRequestError);
      const httpError = error as HttpRequestError;
      expect(httpError.message).toBe("HTTP 400: OK");
      expect(httpError.status).toBe(400);
      expect(httpError.data).toEqual(responseData);
    }
  });

  it("should parse ResponseMetadata.Error even when status is 200", async () => {
    const mockHandler = new MockRequestHandler();
    const responseData = {
      ResponseMetadata: {
        RequestId: "req-200",
        Action: "Test",
        Version: "1",
        Service: "test",
        Region: "cn-beijing",
        Error: {
          Code: "BusinessError",
          Message: "Something went wrong logically",
        },
      },
    };

    mockHandler.mock("https://test.com/", {
      status: 200,
      data: responseData,
    });

    const { middleware } = createHttpRequestMiddleware(mockHandler);
    const next = jest.fn();
    const context: MiddlewareContext = {} as any;

    const handler = middleware(next, context);

    try {
      await handler({
        request: {
          host: "test.com",
          protocol: "https",
          path: "/",
        } as any,
        input: {},
      });
      throw new Error("Should have thrown HttpRequestError for business error");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpRequestError);
      const httpError = error as HttpRequestError;
      expect(httpError.message).toBe(
        "[BusinessError] Something went wrong logically (RequestId: req-200)"
      );
      expect(httpError.status).toBe(200);
      expect(httpError.data).toEqual(responseData);
    }
  });
});
