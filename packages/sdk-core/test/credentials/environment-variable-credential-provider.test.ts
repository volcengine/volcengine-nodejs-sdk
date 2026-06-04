import { EnvironmentVariableCredentialProvider } from "../../src/credentials/EnvironmentVariableCredentialProvider";

describe("EnvironmentVariableCredentialProvider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // 清理所有凭证相关环境变量
    delete process.env.VOLCENGINE_ACCESS_KEY;
    delete process.env.VOLCENGINE_SECRET_KEY;
    delete process.env.VOLCENGINE_SESSION_TOKEN;
    delete process.env.VOLCSTACK_ACCESS_KEY_ID;
    delete process.env.VOLCSTACK_SECRET_ACCESS_KEY;
    delete process.env.VOLCSTACK_ACCESS_KEY;
    delete process.env.VOLCSTACK_SECRET_KEY;
    delete process.env.VOLCSTACK_SESSION_TOKEN;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should resolve credentials from VOLCENGINE_* env vars", async () => {
    process.env.VOLCENGINE_ACCESS_KEY = "env-ak";
    process.env.VOLCENGINE_SECRET_KEY = "env-sk";
    process.env.VOLCENGINE_SESSION_TOKEN = "env-token";

    const provider = new EnvironmentVariableCredentialProvider();
    const creds = await provider.resolveCredentials();

    expect(creds.accessKeyId).toBe("env-ak");
    expect(creds.secretAccessKey).toBe("env-sk");
    expect(creds.sessionToken).toBe("env-token");
    expect(creds.providerName).toBe("EnvironmentVariableCredentialProvider");
  });

  it("should resolve credentials from VOLCSTACK_* env vars", async () => {
    process.env.VOLCSTACK_ACCESS_KEY_ID = "stack-ak";
    process.env.VOLCSTACK_SECRET_ACCESS_KEY = "stack-sk";

    const provider = new EnvironmentVariableCredentialProvider();
    const creds = await provider.resolveCredentials();

    expect(creds.accessKeyId).toBe("stack-ak");
    expect(creds.secretAccessKey).toBe("stack-sk");
    expect(creds.sessionToken).toBeUndefined();
  });

  it("should throw if no credentials in env", () => {
    expect(() => new EnvironmentVariableCredentialProvider()).toThrow(
      "环境变量中未找到有效凭证",
    );
  });

  it("should throw if only accessKeyId is set", () => {
    process.env.VOLCENGINE_ACCESS_KEY = "ak-only";

    expect(() => new EnvironmentVariableCredentialProvider()).toThrow(
      "环境变量中未找到有效凭证",
    );
  });
});
