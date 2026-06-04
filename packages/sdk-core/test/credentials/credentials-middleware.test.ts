/**
 * credentials middleware 单测
 * 验证 credentialsMiddleware 的三条路径：
 *   1. 已有 AK/SK → 直接透传
 *   2. 有 credentialProvider → 调用 provider
 *   3. 无 provider → DefaultCredentialProvider 兜底
 */
import fs from "fs";
import os from "os";
import path from "path";
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

  it("should resolve credentialProvider on every request after credentials are injected", async () => {
    const mockProvider = {
      providerName: "RefreshingProvider",
      resolveCredentials: jest
        .fn()
        .mockResolvedValueOnce({
          accessKeyId: "provider-ak-1",
          secretAccessKey: "provider-sk-1",
          sessionToken: "provider-token-1",
          providerName: "RefreshingProvider",
        })
        .mockResolvedValueOnce({
          accessKeyId: "provider-ak-2",
          secretAccessKey: "provider-sk-2",
          sessionToken: "provider-token-2",
          providerName: "RefreshingProvider",
        }),
    };

    const clientConfig = { credentialProvider: mockProvider } as any;
    const ctx = makeContext(clientConfig);
    const handler = credentialsMiddleware.middleware(nextFn, ctx);

    await handler({ request: {}, input: {} });
    await handler({ request: {}, input: {} });

    expect(mockProvider.resolveCredentials).toHaveBeenCalledTimes(2);
    expect(clientConfig.accessKeyId).toBe("provider-ak-2");
    expect(clientConfig.secretAccessKey).toBe("provider-sk-2");
    expect(clientConfig.sessionToken).toBe("provider-token-2");
    expect(nextFn).toHaveBeenCalledTimes(2);
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

  it("should clear stale sessionToken when refreshed credentials omit it", async () => {
    const mockProvider = {
      providerName: "RefreshingProvider",
      resolveCredentials: jest
        .fn()
        .mockResolvedValueOnce({
          accessKeyId: "provider-ak-1",
          secretAccessKey: "provider-sk-1",
          sessionToken: "provider-token-1",
          providerName: "RefreshingProvider",
        })
        .mockResolvedValueOnce({
          accessKeyId: "provider-ak-2",
          secretAccessKey: "provider-sk-2",
          providerName: "RefreshingProvider",
        }),
    };

    const clientConfig = { credentialProvider: mockProvider } as any;
    const ctx = makeContext(clientConfig);
    const handler = credentialsMiddleware.middleware(nextFn, ctx);

    await handler({ request: {}, input: {} });
    await handler({ request: {}, input: {} });

    expect(clientConfig.accessKeyId).toBe("provider-ak-2");
    expect(clientConfig.secretAccessKey).toBe("provider-sk-2");
    expect(clientConfig.sessionToken).toBeUndefined();
  });

  it("should throw when credentialProvider returns invalid credentials", async () => {
    const mockProvider = {
      providerName: "InvalidProvider",
      resolveCredentials: jest.fn().mockResolvedValue({
        accessKeyId: "",
        secretAccessKey: "",
        providerName: "InvalidProvider",
      }),
    };

    const clientConfig = { credentialProvider: mockProvider } as any;
    const ctx = makeContext(clientConfig);
    const handler = credentialsMiddleware.middleware(nextFn, ctx);

    await expect(handler({ request: {}, input: {} })).rejects.toThrow(
      "InvalidProvider: 未返回有效凭证",
    );

    expect(nextFn).not.toHaveBeenCalled();
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

  it("should fall back to legacy ~/.volc/config when default credential chain fails", async () => {
    const originalEnv = process.env;
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "volc-legacy-"));

    process.env = { ...originalEnv };
    delete process.env.VOLCENGINE_ACCESS_KEY;
    delete process.env.VOLCENGINE_SECRET_KEY;
    delete process.env.VOLCENGINE_SESSION_TOKEN;
    delete process.env.VOLCSTACK_ACCESS_KEY_ID;
    delete process.env.VOLCSTACK_SECRET_ACCESS_KEY;
    delete process.env.VOLCSTACK_ACCESS_KEY;
    delete process.env.VOLCSTACK_SECRET_KEY;
    delete process.env.VOLCSTACK_SESSION_TOKEN;
    delete process.env.VOLCENGINE_OIDC_ROLE_TRN;
    delete process.env.VOLCENGINE_OIDC_TOKEN_FILE;
    delete process.env.VOLCENGINE_CLI_CONFIG_FILE;
    process.env.VOLCENGINE_ECS_METADATA_DISABLED = "true";
    process.env.HOME = tempHome;

    try {
      const legacyConfigDir = path.join(tempHome, ".volc");
      fs.mkdirSync(legacyConfigDir);
      fs.writeFileSync(
        path.join(legacyConfigDir, "config"),
        JSON.stringify({
          VOLC_ACCESSKEY: "legacy-ak",
          VOLC_SECRETKEY: "legacy-sk",
        }),
      );

      const clientConfig = {} as any;
      const ctx = makeContext(clientConfig);
      const handler = credentialsMiddleware.middleware(nextFn, ctx);

      await handler({ request: {}, input: {} });

      expect(clientConfig.accessKeyId).toBe("legacy-ak");
      expect(clientConfig.secretAccessKey).toBe("legacy-sk");
      expect(clientConfig.sessionToken).toBeUndefined();
      expect(nextFn).toHaveBeenCalledTimes(1);
    } finally {
      fs.rmSync(tempHome, { recursive: true, force: true });
      process.env = originalEnv;
    }
  });
});
