import { resolveConfig } from "../src/config";

describe("resolveConfig", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("should use defaults", () => {
    delete process.env.ARK_API_KEY;
    delete process.env.ARK_BASE_URL;
    const config = resolveConfig({});
    expect(config.region).toBe("cn-beijing");
    expect(config.baseURL).toBe("https://ark.cn-beijing.volces.com/api/v3");
    expect(config.timeout).toBe(600000);
    expect(config.emptyMessagesLimit).toBe(300);
    expect(config.retryTimes).toBe(2);
    expect(config.batchMaxParallel).toBe(3000);
  });

  it("should use provided apiKey", () => {
    const config = resolveConfig({ apiKey: "test-key" });
    expect(config.apiKey).toBe("test-key");
  });

  it("should use ARK_API_KEY env var as fallback", () => {
    process.env.ARK_API_KEY = "env-key";
    const config = resolveConfig({});
    expect(config.apiKey).toBe("env-key");
  });

  it("should use ARK_BASE_URL env var as fallback", () => {
    process.env.ARK_BASE_URL = "https://custom.api.com/v3";
    const config = resolveConfig({});
    expect(config.baseURL).toBe("https://custom.api.com/v3");
  });

  it("should strip trailing slash from baseURL", () => {
    const config = resolveConfig({ baseURL: "https://api.example.com/v3/" });
    expect(config.baseURL).toBe("https://api.example.com/v3");
  });

  it("should use provided ak/sk", () => {
    const config = resolveConfig({ ak: "my-ak", sk: "my-sk" });
    expect(config.ak).toBe("my-ak");
    expect(config.sk).toBe("my-sk");
  });

  it("should use provided timeout", () => {
    const config = resolveConfig({ timeout: 30000 });
    expect(config.timeout).toBe(30000);
  });

  it("should use provided retryTimes", () => {
    const config = resolveConfig({ retryTimes: 5 });
    expect(config.retryTimes).toBe(5);
  });
});
