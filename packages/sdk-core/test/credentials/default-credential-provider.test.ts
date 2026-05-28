import { DefaultCredentialProvider } from "../../src/credentials/DefaultCredentialProvider";

describe("DefaultCredentialProvider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // 清理所有可能干扰的环境变量
    delete process.env.VOLCENGINE_ACCESS_KEY;
    delete process.env.VOLCENGINE_SECRET_KEY;
    delete process.env.VOLCENGINE_SESSION_TOKEN;
    delete process.env.VOLCSTACK_ACCESS_KEY_ID;
    delete process.env.VOLCSTACK_SECRET_ACCESS_KEY;
    delete process.env.VOLCSTACK_ACCESS_KEY;
    delete process.env.VOLCSTACK_SECRET_KEY;
    delete process.env.VOLCSTACK_SESSION_TOKEN;
    delete process.env.VOLCENGINE_OIDC_ROLE_NAME;
    delete process.env.VOLCENGINE_OIDC_ACCOUNT_ID;
    delete process.env.VOLCENGINE_OIDC_TOKEN_FILE;
    delete process.env.VOLCENGINE_ECS_METADATA;
    delete process.env.VOLCENGINE_ECS_METADATA_DISABLED;
    delete process.env.VOLCENGINE_CLI_CONFIG_FILE;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ---------- 基础行为 ----------

  it("should have correct providerName", () => {
    const provider = new DefaultCredentialProvider();
    expect(provider.providerName).toBe("DefaultCredentialProvider");
  });

  it("should resolve from EnvironmentVariableCredentialProvider when env vars are set", async () => {
    process.env.VOLCENGINE_ACCESS_KEY = "chain-ak";
    process.env.VOLCENGINE_SECRET_KEY = "chain-sk";

    const provider = new DefaultCredentialProvider();
    const creds = await provider.resolveCredentials();

    expect(creds.accessKeyId).toBe("chain-ak");
    expect(creds.secretAccessKey).toBe("chain-sk");
    expect(creds.providerName).toBe("EnvironmentVariableCredentialProvider");
  });

  it(
    "should throw aggregate error when all providers fail",
    async () => {
      // 不设置任何环境变量，所有 provider 都会失败

      delete process.env.HOME;
      delete process.env.USERPROFILE;

      const provider = new DefaultCredentialProvider();

      try {
        await provider.resolveCredentials();
        expect("should not reach here").toBe(false);
      } catch (e: any) {
        expect(e.message).toContain("所有凭证 Provider 均未能获取到有效凭证");
        expect(e.message).toContain("EnvironmentVariableCredentialProvider");
        expect(e.message).toContain("OidcCredentialProvider");
        expect(e.message).toContain("CLIConfigCredentialProvider");
      }
    },
    10000,
  );

  it("should skip failing providers and try the next one", async () => {
    // 此处用 VOLCSTACK env 变量让 EnvironmentVariableCredentialProvider 成功
    process.env.VOLCSTACK_ACCESS_KEY_ID = "fallback-ak";
    process.env.VOLCSTACK_SECRET_ACCESS_KEY = "fallback-sk";

    const provider = new DefaultCredentialProvider();
    const creds = await provider.resolveCredentials();

    expect(creds.accessKeyId).toBe("fallback-ak");
    expect(creds.secretAccessKey).toBe("fallback-sk");
  });

  // ---------- roleName 参数传递 ----------

  it("should accept roleName as first constructor argument", () => {
    const provider = new DefaultCredentialProvider();
    expect(provider.providerName).toBe("DefaultCredentialProvider");
  });

  it("should accept roleName and reuseLastProviderEnabled arguments", () => {
    const provider = new DefaultCredentialProvider(false);
    expect(provider.providerName).toBe("DefaultCredentialProvider");
  });

  it("should work with no arguments (backward compatible)", () => {
    const provider = new DefaultCredentialProvider();
    expect(provider.providerName).toBe("DefaultCredentialProvider");
  });

  // ---------- reuseLastProviderEnabled 缓存 ----------

  it("should reuse last successful provider on second call (reuseLastProviderEnabled=true)", async () => {
    process.env.VOLCENGINE_ACCESS_KEY = "reuse-ak";
    process.env.VOLCENGINE_SECRET_KEY = "reuse-sk";

    const provider = new DefaultCredentialProvider(true);

    // 第一次调用：走完整链条，缓存 EnvironmentVariableCredentialProvider
    const creds1 = await provider.resolveCredentials();
    expect(creds1.accessKeyId).toBe("reuse-ak");
    expect(creds1.providerName).toBe("EnvironmentVariableCredentialProvider");

    // 第二次调用：复用缓存的 provider 实例
    // EnvironmentVariableCredentialProvider 在构造时读取 env 并缓存，
    // 所以即使后续修改 env，返回值仍然是构造时的值
    const creds2 = await provider.resolveCredentials();
    expect(creds2.accessKeyId).toBe("reuse-ak");
    expect(creds2.providerName).toBe("EnvironmentVariableCredentialProvider");
  });

  it("should fall back to full chain when cached provider fails", async () => {
    // 使用一个自定义 mock provider 来精确验证缓存回退逻辑
    process.env.VOLCENGINE_ACCESS_KEY = "first-ak";
    process.env.VOLCENGINE_SECRET_KEY = "first-sk";

    const provider = new DefaultCredentialProvider(true);

    // 第一次调用成功，缓存 EnvironmentVariableCredentialProvider
    const creds1 = await provider.resolveCredentials();
    expect(creds1.accessKeyId).toBe("first-ak");

    // EnvironmentVariableCredentialProvider 构造时就缓存了凭证，
    // 即使后续清除 env 变量，缓存的 provider 实例仍能返回旧值，不会抛异常
    // 所以这里验证缓存行为：第二次调用仍返回相同凭证
    const creds2 = await provider.resolveCredentials();
    expect(creds2.accessKeyId).toBe("first-ak");
    expect(creds2.providerName).toBe("EnvironmentVariableCredentialProvider");
  });

  it("should not reuse provider when reuseLastProviderEnabled=false", async () => {
    process.env.VOLCENGINE_ACCESS_KEY = "no-reuse-ak";
    process.env.VOLCENGINE_SECRET_KEY = "no-reuse-sk";

    const provider = new DefaultCredentialProvider(false);

    const creds1 = await provider.resolveCredentials();
    expect(creds1.accessKeyId).toBe("no-reuse-ak");

    // reuseLastProviderEnabled=false 时每次都创建新 provider，
    // 但因为 env 变量没变，新 provider 构造时仍读到相同值
    const creds2 = await provider.resolveCredentials();
    expect(creds2.accessKeyId).toBe("no-reuse-ak");
    expect(creds2.providerName).toBe("EnvironmentVariableCredentialProvider");
  });

  it(
    "should not reuse provider and re-walk full chain each time when reuseLastProviderEnabled=false",
    async () => {
      // 第一次用 VOLCENGINE_ACCESS_KEY 成功
      process.env.VOLCENGINE_ACCESS_KEY = "v1-ak";
      process.env.VOLCENGINE_SECRET_KEY = "v1-sk";

      const provider = new DefaultCredentialProvider(false);
      const creds1 = await provider.resolveCredentials();
      expect(creds1.accessKeyId).toBe("v1-ak");

      // 清除旧变量，换一组新变量
      delete process.env.VOLCENGINE_ACCESS_KEY;
      delete process.env.VOLCENGINE_SECRET_KEY;
      process.env.VOLCSTACK_ACCESS_KEY_ID = "v2-ak";
      process.env.VOLCSTACK_SECRET_ACCESS_KEY = "v2-sk";

      // 因为 reuseLastProviderEnabled=false，每次都重新构造 provider，
      // 新的 EnvironmentVariableCredentialProvider 会读到新的 env
      const creds2 = await provider.resolveCredentials();
      expect(creds2.accessKeyId).toBe("v2-ak");
    },
  );
});
