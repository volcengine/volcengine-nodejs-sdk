import { retry } from "../src/utils/retry";

describe("retry", () => {
  it("should succeed without retries", async () => {
    let callCount = 0;
    const result = await retry(
      { maxAttempts: 3, initialBackoffMs: 10, maxBackoffMs: 100 },
      async () => {
        callCount++;
        return "ok";
      },
      () => true,
    );
    expect(result).toBe("ok");
    expect(callCount).toBe(1);
  });

  it("should retry on retryable errors", async () => {
    let callCount = 0;
    const result = await retry(
      { maxAttempts: 3, initialBackoffMs: 10, maxBackoffMs: 100 },
      async () => {
        callCount++;
        if (callCount < 3) throw new Error("temporary");
        return "success";
      },
      () => true,
    );
    expect(result).toBe("success");
    expect(callCount).toBe(3);
  });

  it("should not retry non-retryable errors", async () => {
    let callCount = 0;
    await expect(
      retry(
        { maxAttempts: 3, initialBackoffMs: 10, maxBackoffMs: 100 },
        async () => {
          callCount++;
          throw new Error("permanent");
        },
        () => false,
      ),
    ).rejects.toThrow("permanent");
    expect(callCount).toBe(1);
  });

  it("should throw after max attempts (initial + retries)", async () => {
    let callCount = 0;
    await expect(
      retry(
        { maxAttempts: 2, initialBackoffMs: 10, maxBackoffMs: 100 },
        async () => {
          callCount++;
          throw new Error("always fails");
        },
        () => true,
      ),
    ).rejects.toThrow("always fails");
    // maxAttempts=2 means: attempt 0 (initial) + attempt 1 (retry) + attempt 2 (retry) = 3 total
    expect(callCount).toBe(3);
  });

  it("should support abort signal", async () => {
    const controller = new AbortController();
    // Abort immediately
    controller.abort();
    await expect(
      retry(
        { maxAttempts: 3, initialBackoffMs: 1000, maxBackoffMs: 5000 },
        async () => {
          throw new Error("should retry");
        },
        () => true,
        controller.signal,
      ),
    ).rejects.toThrow();
  });
});
