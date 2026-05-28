/**
 * credentials middleware 单测
 * 验证 credentialsMiddleware 的三条路径：
 *   1. 已有 AK/SK → 直接透传
 *   2. 有 credentialProvider → 调用 provider
 *   3. 无 provider → DefaultCredentialProvider 兜底
 */
import { credentialsMiddleware } from "../../src/middlewares/credentials";

describe("credentialsMiddleware", () => {
  const makeContext = (clientConfig: any) => ({
    clientName: "TestClient",
    commandName: "TestCommand",
    clientConfig,
  });

  const nextFn = jest.fn().mockResolvedValue({ ok: true });

  beforeEach(() => {
    nextFn.mockClear();
  });

  it("should pass through when accessKeyId and secretAccessKey are set", async () => {
    const clientConfig = {
      accessKeyId: "inline-ak",
      secretAccessKey: "inline-sk",
    };
    const ctx = makeContext(clientConfig);
    const handler = credentialsMiddleware.middleware(nextFn, ctx);

    await handler({ request: {}, input: {} });

    expect(nextFn).toHaveBeenCalledTimes(1);
    // credentials unchanged
    expect(clientConfig.accessKeyId).toBe("inline-ak");
    expect(clientConfig.secretAccessKey).toBe("inline-sk");
  });

  it("should use credentialProvider when set", async () => {
    const mockProvider = {
      providerName: "MockProvider",
      resolveCredentials: jest.fn().mockResolvedValue({
        accessKeyId: "provider-ak",
        secretAccessKey: "provider-sk",
        sessionToken: "provider-token",
        providerName: "MockProvider",
      }),
    };

    const clientConfig = { credentialProvider: mockProvider } as any;
    const ctx = makeContext(clientConfig);
    const handler = credentialsMiddleware.middleware(nextFn, ctx);

    await handler({ request: {}, input: {} });

    expect(mockProvider.resolveCredentials).toHaveBeenCalledTimes(1);
    expect(clientConfig.accessKeyId).toBe("provider-ak");
    expect(clientConfig.secretAccessKey).toBe("provider-sk");
    expect(clientConfig.sessionToken).toBe("provider-token");
    expect(nextFn).toHaveBeenCalledTimes(1);
  });

  it("should not set sessionToken if provider returns undefined", async () => {
    const mockProvider = {
      providerName: "NoTokenProvider",
      resolveCredentials: jest.fn().mockResolvedValue({
        accessKeyId: "ak",
        secretAccessKey: "sk",
        providerName: "NoTokenProvider",
      }),
    };

    const clientConfig = { credentialProvider: mockProvider } as any;
    const ctx = makeContext(clientConfig);
    const handler = credentialsMiddleware.middleware(nextFn, ctx);

    await handler({ request: {}, input: {} });

    expect(clientConfig.sessionToken).toBeUndefined();
  });

  it("should fall back to DefaultCredentialProvider when no provider and no AK/SK", async () => {
    // 设置环境变量让 DefaultCredentialProvider 的 EnvironmentVariableCredentialProvider 命中
    const originalEnv = process.env;
    process.env = { ...originalEnv };
    process.env.VOLCENGINE_ACCESS_KEY = "default-ak";
    process.env.VOLCENGINE_SECRET_KEY = "default-sk";

    try {
      const clientConfig = {} as any;
      const ctx = makeContext(clientConfig);
      const handler = credentialsMiddleware.middleware(nextFn, ctx);

      await handler({ request: {}, input: {} });

      expect(clientConfig.accessKeyId).toBe("default-ak");
      expect(clientConfig.secretAccessKey).toBe("default-sk");
      expect(nextFn).toHaveBeenCalledTimes(1);
    } finally {
      process.env = originalEnv;
    }
  });
});
