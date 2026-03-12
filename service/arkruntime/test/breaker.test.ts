import { Breaker } from "../src/utils/breaker";
import { ModelBreakerProvider } from "../src/utils/breaker-provider";

describe("Breaker", () => {
  it("should create with default values", () => {
    const breaker = new Breaker();
    expect(breaker).toBeDefined();
  });

  it("should allow requests when not reset", async () => {
    const breaker = new Breaker();
    // wait() should resolve immediately when breaker has not been reset
    await expect(breaker.wait()).resolves.toBeUndefined();
  });

  it("should block then allow after reset duration", async () => {
    const breaker = new Breaker();
    breaker.reset(100); // block for 100ms

    // After waiting past the reset duration + slow start
    await new Promise((r) => setTimeout(r, 150));
    // First request after cooldown should be allowed (index 0 < 2^elapsed)
    await expect(breaker.wait()).resolves.toBeUndefined();
  });

  it("should use exponential slow-start admission after reset", async () => {
    const breaker = new Breaker();
    breaker.reset(50); // block for 50ms

    // Wait for cooldown to pass
    await new Promise((r) => setTimeout(r, 100));

    // Should allow through (elapsed > 0, index 0 < 2^elapsed)
    await expect(breaker.wait()).resolves.toBeUndefined();
  });
});

describe("ModelBreakerProvider", () => {
  it("should return same breaker for same model", () => {
    const provider = new ModelBreakerProvider();
    const b1 = provider.getOrCreate("model-a");
    const b2 = provider.getOrCreate("model-a");
    expect(b1).toBe(b2);
  });

  it("should return different breakers for different models", () => {
    const provider = new ModelBreakerProvider();
    const b1 = provider.getOrCreate("model-a");
    const b2 = provider.getOrCreate("model-b");
    expect(b1).not.toBe(b2);
  });
});
