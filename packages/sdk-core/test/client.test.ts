import { Client } from "../src/index";
import { MockRequestHandler } from "../src/testing/mock-request-handler";

describe("Client with MockRequestHandler", () => {
  test("should use mock handler", async () => {
    // Arrange
    const mockHandler = new MockRequestHandler();
    mockHandler.mock("https://example.com/api/test", {
      status: 200,
      data: { result: "success" },
    });

    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      requestHandler: mockHandler,
    });

    // Act
    await client.destroy();

    // Assert
    expect(mockHandler.getRequestCount()).toBe(0); // No requests made yet
  });

  test("mock handler records requests", async () => {
    // Arrange
    const mockHandler = new MockRequestHandler();
    mockHandler.mock(/https:\/\/example\.com\/.*/, {
      status: 200,
      data: { success: true },
    });

    // Act - 直接调用 handler
    await mockHandler.request({
      url: "https://example.com/api/test",
      method: "POST",
      headers: { "content-type": "application/json" },
      data: { test: "data" },
    });

    // Assert
    expect(mockHandler.getRequestCount()).toBe(1);
    const lastRequest = mockHandler.getLastRequest();
    expect(lastRequest?.url).toBe("https://example.com/api/test");
    expect(lastRequest?.method).toBe("POST");
  });
});

describe("Client destroy", () => {
  test("should call destroy on requestHandler if available", async () => {
    // Arrange
    const mockHandlerWithDestroy = {
      request: jest.fn().mockResolvedValue({ status: 200, data: {} }),
      destroy: jest.fn(),
    };

    const client = new Client({
      host: "example.com",
      requestHandler: mockHandlerWithDestroy as any,
    });

    // Act
    await client.destroy();

    // Assert
    expect(mockHandlerWithDestroy.destroy).toHaveBeenCalledTimes(1);
  });

  test("should not throw if requestHandler does not have destroy method", () => {
    // Arrange
    const handlerWithoutDestroy = {
      request: jest.fn().mockResolvedValue({ status: 200, data: {} }),
      // No destroy method
    };

    const client = new Client({
      host: "example.com",
      requestHandler: handlerWithoutDestroy as any,
    });

    // Act & Assert
    expect(() => client.destroy()).not.toThrow();
  });

  test("should not throw if destroy is called on client without requestHandler", () => {
    // Arrange
    const client = new Client({
      host: "example.com",
      // No requestHandler - will use default AxiosRequestHandler which has destroy
    });

    // Act & Assert
    expect(() => client.destroy()).not.toThrow();
  });

  test("should handle multiple destroy calls", () => {
    // Arrange
    const mockHandlerWithDestroy = {
      request: jest.fn().mockResolvedValue({ status: 200, data: {} }),
      destroy: jest.fn(),
    };

    const client = new Client({
      host: "example.com",
      requestHandler: mockHandlerWithDestroy as any,
    });

    // Act
    client.destroy();
    client.destroy();
    client.destroy();

    // Assert - should be called each time
    expect(mockHandlerWithDestroy.destroy).toHaveBeenCalledTimes(3);
  });

  test("should preserve credentials after destroy", () => {
    // Arrange
    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      requestHandler: new MockRequestHandler(),
    });

    // Act
    client.destroy();

    // Assert - config should still be accessible
    expect(client.config.accessKeyId).toBe("test-key");
    expect(client.config.secretAccessKey).toBe("test-secret");
  });
});

describe("Client debugMiddlewareStack", () => {
  test("should return formatted string of full middleware stack", () => {
    // Arrange
    const client = new Client({
      host: "example.com",
      requestHandler: new MockRequestHandler(),
    });

    const command: any = {
      middlewareStack: {
        steps: {
          initialize: [],
          serialize: [],
          build: [],
          finalizeRequest: [],
        },
      },
    };

    // Add a custom middleware to command to verify merge
    command.middlewareStack.steps.build.push({
      fn: () => () => Promise.resolve({}),
      name: "CustomCommandMiddleware",
      step: "build",
      priority: 99,
    });

    // Act
    const output = client.debugMiddlewareStack(command);

    // Assert
    expect(output).toContain("MiddlewareStack:");
    // Check for some default middlewares
    expect(output).toContain("defaultHeadersMiddleware");
    expect(output).toContain("credentialsMiddleware");
    expect(output).toContain("endpointMiddleware");
    expect(output).toContain("dotNMiddleware");
    expect(output).toContain("signerMiddleware");
    expect(output).toContain("retryMiddleware");
    expect(output).toContain("httpRequestMiddleware");

    // Check for custom command middleware
    expect(output).toContain("CustomCommandMiddleware (priority: 99)");

    // Check structure
    expect(output).toContain("[initialize]");
    expect(output).toContain("[serialize]");
    expect(output).toContain("[build]");
    expect(output).toContain("[finalizeRequest]");
  });
});
