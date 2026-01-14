import { HttpRequestError } from "../src/types/http-request-error";

describe("HttpRequestError", () => {
  describe("Constructor and basic properties", () => {
    test("should create error with message only (default name is Exception)", () => {
      const error = new HttpRequestError(undefined, "Request failed");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(HttpRequestError);
      expect(error.message).toBe("Request failed");
      expect(error.name).toBe("Exception");
    });

    test("should create error with message and name", () => {
      const error = new HttpRequestError("ApiException", "Not found");

      expect(error.message).toBe("Not found");
      expect(error.name).toBe("ApiException");
    });

    test("should create error with message, name, and status", () => {
      const error = new HttpRequestError("ApiException", "Not found", 404);

      expect(error.message).toBe("Not found");
      expect(error.name).toBe("ApiException");
      expect(error.status).toBe(404);
    });

    test("should create error with message, name, status, and data", () => {
      const data = { error: "Resource not found" };
      const error = new HttpRequestError(
        "ApiException",
        "Not found",
        404,
        data
      );

      expect(error.message).toBe("Not found");
      expect(error.name).toBe("ApiException");
      expect(error.status).toBe(404);
      expect(error.data).toEqual(data);
    });

    test("should create error with all parameters", () => {
      const data = { error: "Server error" };
      const originalError = new Error("Network timeout");
      const error = new HttpRequestError(
        "NetworkError",
        "Internal Server Error",
        500,
        data,
        originalError
      );

      expect(error.message).toBe("Internal Server Error");
      expect(error.name).toBe("NetworkError");
      expect(error.status).toBe(500);
      expect(error.data).toEqual(data);
      expect(error.originalError).toBe(originalError);
    });

    test("should have proper stack trace", () => {
      const error = new HttpRequestError("Exception", "Test error");

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("Exception");
      expect(error.stack).toContain("Test error");
    });
  });

  describe("Error equality and comparison", () => {
    test("two errors with same message should not be equal (different instances)", () => {
      const error1 = new HttpRequestError("Exception", "Same message");
      const error2 = new HttpRequestError("Exception", "Same message");

      expect(error1).not.toBe(error2);
      expect(error1.message).toBe(error2.message);
    });

    test("should inherit from Error prototype", () => {
      const error = new HttpRequestError("Exception", "Test error");

      expect(error instanceof Error).toBe(true);
      expect(error instanceof HttpRequestError).toBe(true);
      expect(typeof error.toString).toBe("function");
    });
  });

  describe("toString method", () => {
    test("should return error name and message", () => {
      const error = new HttpRequestError("Exception", "Test error message");
      const str = error.toString();

      expect(str).toContain("Exception");
      expect(str).toContain("Test error message");
    });
  });

  describe("Error with complex data", () => {
    test("should handle complex nested data objects", () => {
      const complexData = {
        code: "VALIDATION_ERROR",
        details: {
          field: "email",
          message: "Invalid email format",
        },
        metadata: {
          timestamp: "2024-01-01T12:00:00Z",
          requestId: "req-12345",
        },
      };

      const error = new HttpRequestError(
        "ApiException",
        "Validation failed",
        400,
        complexData
      );

      expect(error.data).toEqual(complexData);
      expect(error.data.details.field).toBe("email");
      expect(error.data.metadata.requestId).toBe("req-12345");
    });

    test("should handle array data", () => {
      const errorData = [
        { field: "email", error: "Invalid format" },
        { field: "password", error: "Too short" },
      ];

      const error = new HttpRequestError(
        "ApiException",
        "Validation errors",
        422,
        errorData
      );

      expect(error.data).toEqual(errorData);
      expect(error.data).toHaveLength(2);
      expect(error.data[0].field).toBe("email");
    });
  });

  describe("Error with undefined or null values", () => {
    test("should handle undefined status", () => {
      const error = new HttpRequestError("Exception", "Error", undefined);

      expect(error.status).toBeUndefined();
      expect(error.message).toBe("Error");
    });

    test("should handle null data", () => {
      const error = new HttpRequestError("Exception", "Error", 500, null);

      expect(error.data).toBeNull();
    });

    test("should handle undefined originalError", () => {
      const error = new HttpRequestError(
        "Exception",
        "Error",
        500,
        {},
        undefined
      );

      expect(error.originalError).toBeUndefined();
    });

    test("should handle null originalError", () => {
      const error = new HttpRequestError("Exception", "Error", 500, {}, null);

      expect(error.originalError).toBeNull();
    });
  });

  describe("Throwing and catching HttpRequestError", () => {
    test("should be catchable in try-catch block", () => {
      try {
        throw new HttpRequestError("ApiException", "Thrown error", 503);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpRequestError);
        expect((error as HttpRequestError).message).toBe("Thrown error");
        expect((error as HttpRequestError).status).toBe(503);
      }
    });

    test("should work with Promise rejection", async () => {
      const promise = Promise.reject(
        new HttpRequestError("Exception", "Async error", 408)
      );

      await expect(promise).rejects.toThrow(HttpRequestError);
      await expect(promise).rejects.toThrow("Async error");
    });
  });

  describe("Error property immutability", () => {
    test("should allow modifying error properties after creation", () => {
      const error = new HttpRequestError("Exception", "Original message", 404);

      error.status = 500;
      error.message = "Modified message";

      expect(error.status).toBe(500);
      expect(error.message).toBe("Modified message");
    });

    test("should allow adding custom properties", () => {
      const error = new HttpRequestError("Exception", "Test", 400);

      (error as any).customProp = "custom value";

      expect((error as any).customProp).toBe("custom value");
    });
  });

  describe("Common HTTP error scenarios", () => {
    test("should represent 404 Not Found error", () => {
      const error = new HttpRequestError(
        "ApiException",
        "Resource not found",
        404,
        {
          resource: "/api/users/123",
        }
      );

      expect(error.status).toBe(404);
      expect(error.message).toBe("Resource not found");
      expect(error.data.resource).toBe("/api/users/123");
    });

    test("should represent 401 Unauthorized error", () => {
      const error = new HttpRequestError(
        "ApiException",
        "Unauthorized access",
        401,
        {
          required: "Bearer token",
        }
      );

      expect(error.status).toBe(401);
      expect(error.message).toBe("Unauthorized access");
    });

    test("should represent 500 Internal Server Error", () => {
      const error = new HttpRequestError(
        "ApiException",
        "Internal server error",
        500,
        {
          errorId: "err-123",
        }
      );

      expect(error.status).toBe(500);
      expect(error.message).toBe("Internal server error");
    });

    test("should represent network errors without status", () => {
      const networkError = new Error("ECONNRESET");
      const error = new HttpRequestError(
        "NetworkError",
        "Network error occurred",
        undefined,
        null,
        networkError
      );

      expect(error.status).toBeUndefined();
      expect(error.originalError).toBe(networkError);
    });

    test("should represent timeout errors", () => {
      const error = new HttpRequestError(
        "NetworkError",
        "Request timeout",
        408
      );

      expect(error.status).toBe(408);
      expect(error.message).toBe("Request timeout");
    });
  });

  describe("Error with originalError details", () => {
    test("should preserve original error with message", () => {
      const originalError = new Error("Original error message");
      const httpError = new HttpRequestError(
        "Exception",
        "Wrapped error",
        500,
        null,
        originalError
      );

      expect(httpError.originalError).toBe(originalError);
      expect(httpError.originalError?.message).toBe("Original error message");
    });

    test("should preserve original network error details", () => {
      const networkError: any = new Error("Connection refused");
      networkError.code = "ECONNREFUSED";
      networkError.errno = "ECONNREFUSED";
      networkError.syscall = "connect";

      const error = new HttpRequestError(
        "NetworkError",
        "Connection failed",
        undefined,
        null,
        networkError
      );

      expect(error.originalError?.code).toBe("ECONNREFUSED");
      expect(error.originalError?.errno).toBe("ECONNREFUSED");
      expect(error.originalError?.syscall).toBe("connect");
    });
  });
});
