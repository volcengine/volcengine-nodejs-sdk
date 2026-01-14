import { Client, Command } from "../src/index";
import { MockRequestHandler } from "../src/testing/mock-request-handler";
import { MockClock } from "../src/testing/mock-clock";

describe("AbortController Support", () => {
  test("should pass abortSignal from Command.abortSignal to requestHandler", async () => {
    // Arrange
    const mockHandler = new MockRequestHandler();
    const mockClock = new MockClock();
    let capturedSignal: AbortSignal | undefined;

    mockHandler.mock("https://example.com/", {
      status: 200,
      data: { result: "success" },
    });

    // Wrap the handler to capture the signal
    const originalRequest = mockHandler.request.bind(mockHandler);
    mockHandler.request = async (config) => {
      capturedSignal = config.signal;
      return originalRequest(config);
    };

    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      requestHandler: mockHandler,
      clock: mockClock,
    });

    const controller = new AbortController();
    const command = new Command({ test: "data" });

    (command as any).requestConfig = {
      method: "POST",
      serviceName: "test-service",
      params: { Action: "TestAction", Version: "2023-01-01" },
    };

    // Act
    await client.send(command, { abortSignal: controller.signal });

    // Assert
    expect(capturedSignal).toBe(controller.signal);

    await client.destroy();
  });

  test("should abort request before it starts", async () => {
    // Arrange
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

    const controller = new AbortController();
    controller.abort(); // Abort before sending

    const command = new Command({ test: "data" });

    (command as any).requestConfig = {
      method: "POST",
      serviceName: "test-service",
      params: { Action: "TestAction", Version: "2023-01-01" },
    };

    // Act & Assert
    await expect(
      client.send(command, { abortSignal: controller.signal })
    ).rejects.toThrow("Request aborted");

    expect(mockHandler.getRequestCount()).toBe(1);

    await client.destroy();
  });

  test("should abort request during delay", async () => {
    // Arrange
    const mockClock = new MockClock();
    const mockHandler = new MockRequestHandler({ clock: mockClock });

    // Mock response with 2 second delay
    mockHandler.mock("https://example.com/", {
      status: 200,
      data: { result: "success" },
      delayMs: 2000,
    });

    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      requestHandler: mockHandler,
      clock: mockClock,
    });

    const controller = new AbortController();
    const command = new Command({ test: "data" });

    (command as any).requestConfig = {
      method: "POST",
      serviceName: "test-service",
      params: { Action: "TestAction", Version: "2023-01-01" },
    };

    // Act - Start request
    const sendPromise = client.send(command, {
      abortSignal: controller.signal,
    });

    // Abort after 100ms (using mock clock)
    mockClock.setTimeout(() => controller.abort(), 100);

    // Advance time to trigger the abort
    mockClock.advance(100);

    // Assert
    await expect(sendPromise).rejects.toThrow("Request aborted");

    expect(mockHandler.getRequestCount()).toBe(1);

    await client.destroy();
  });

  test("should complete request successfully if not aborted", async () => {
    // Arrange
    const mockClock = new MockClock();
    const mockHandler = new MockRequestHandler({ clock: mockClock });

    mockHandler.mock("https://example.com/", {
      status: 200,
      data: { result: "success", data: "test" },
      delayMs: 50,
    });

    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      requestHandler: mockHandler,
      clock: mockClock,
    });

    const controller = new AbortController();
    const command = new Command({ test: "data" });

    (command as any).requestConfig = {
      method: "POST",
      serviceName: "test-service",
      params: { Action: "TestAction", Version: "2023-01-01" },
    };

    // Act - Start request
    const sendPromise = client.send(command, {
      abortSignal: controller.signal,
    });

    // Advance time to complete the delay
    mockClock.advance(50);

    // Assert
    const result = await sendPromise;
    expect(result).toEqual({ result: "success", data: "test" });
    expect(mockHandler.getRequestCount()).toBe(1);

    await client.destroy();
  });

  test("should work without abortSignal (backward compatibility)", async () => {
    // Arrange
    const mockHandler = new MockRequestHandler();
    const mockClock = new MockClock();

    mockHandler.mock("https://example.com/", {
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
    // Don't set abortSignal

    (command as any).requestConfig = {
      method: "POST",
      serviceName: "test-service",
      params: { Action: "TestAction", Version: "2023-01-01" },
    };

    // Act
    await client.send(command);

    // Assert
    expect(mockHandler.getRequestCount()).toBe(1);

    await client.destroy();
  });

  test("should abort multiple concurrent requests independently", async () => {
    // Arrange
    const mockClock = new MockClock();
    const mockHandler = new MockRequestHandler({ clock: mockClock });

    // Use shorter delays for faster test execution
    mockHandler.mock(/Action=TestAction1/, {
      status: 200,
      data: { result: "success1" },
      delayMs: 50,
    });

    mockHandler.mock(/Action=TestAction2/, {
      status: 200,
      data: { result: "success2" },
      delayMs: 50,
    });

    mockHandler.mock(/Action=TestAction3/, {
      status: 200,
      data: { result: "success3" },
      delayMs: 50,
    });

    const client = new Client({
      host: "example.com",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      requestHandler: mockHandler,
      clock: mockClock,
    });

    const controller1 = new AbortController();
    const controller2 = new AbortController();
    const controller3 = new AbortController();

    const command1 = new Command({ test: "data1" });
    (command1 as any).requestConfig = {
      method: "POST",
      serviceName: "test-service",
      params: { Action: "TestAction1", Version: "2023-01-01" },
    };

    const command2 = new Command({ test: "data2" });
    (command2 as any).requestConfig = {
      method: "POST",
      serviceName: "test-service",
      params: { Action: "TestAction2", Version: "2023-01-01" },
    };

    const command3 = new Command({ test: "data3" });
    (command3 as any).requestConfig = {
      method: "POST",
      serviceName: "test-service",
      params: { Action: "TestAction3", Version: "2023-01-01" },
    };

    // Act - Start all requests
    const promise1 = client.send(command1, { abortSignal: controller1.signal });
    const promise2 = client.send(command2, { abortSignal: controller2.signal });
    const promise3 = client.send(command3, { abortSignal: controller3.signal });

    // Wait briefly for requests to start
    await new Promise((resolve) => setImmediate(resolve));

    // Abort only request 1 and 3
    controller1.abort();
    controller3.abort();

    // Advance time to complete request 2 (should not be aborted)
    mockClock.advance(50);

    // Assert
    // Request 1 and 3 should be aborted
    await expect(promise1).rejects.toThrow("Request aborted");
    await expect(promise3).rejects.toThrow("Request aborted");

    // Request 2 should complete successfully
    const result2 = await Promise.race([
      promise2,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 1000)
      ),
    ]);
    expect(result2).toEqual({ result: "success2" });

    expect(mockHandler.getRequestCount()).toBe(3);

    await client.destroy();
  });
});
