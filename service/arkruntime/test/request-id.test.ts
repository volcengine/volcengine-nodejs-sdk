import { genRequestId } from "../src/utils/request-id";

describe("genRequestId", () => {
  it("should generate a non-empty string", () => {
    const id = genRequestId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("should generate unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(genRequestId());
    }
    expect(ids.size).toBe(100);
  });

  it("should start with a date-like prefix", () => {
    const id = genRequestId();
    // Format: YYYYMMDDHHmmss-<random>
    const datePrefix = id.substring(0, 14);
    expect(/^\d{14}$/.test(datePrefix)).toBe(true);
  });
});
