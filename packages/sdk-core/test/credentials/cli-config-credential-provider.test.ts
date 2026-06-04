import fs from "fs";
import path from "path";
import { CLIConfigCredentialProvider } from "../../src/credentials/CLIConfigCredentialProvider";

jest.mock("fs");
jest.mock("path");

describe("CLIConfigCredentialProvider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.VOLCENGINE_CLI_CONFIG_FILE;
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should resolve credentials from default config path", async () => {
    process.env.HOME = "/mock/home";

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.volcengine/config.json",
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        current: "default",
        profiles: {
          default: {
            "access-key": "cli-ak",
            "secret-key": "cli-sk",
            "session-token": "cli-token",
          },
        },
      }),
    );

    const provider = new CLIConfigCredentialProvider();
    const creds = await provider.resolveCredentials();

    expect(creds.accessKeyId).toBe("cli-ak");
    expect(creds.secretAccessKey).toBe("cli-sk");
    expect(creds.sessionToken).toBe("cli-token");
    expect(creds.providerName).toBe("CLIConfigCredentialProvider");
  });

  it("should use VOLCENGINE_CLI_CONFIG_FILE env var if set", async () => {
    process.env.VOLCENGINE_CLI_CONFIG_FILE = "/custom/path/config.json";

    (path.resolve as jest.Mock).mockReturnValue("/custom/path/config.json");
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        current: "prod",
        profiles: {
          prod: {
            "access-key": "custom-ak",
            "secret-key": "custom-sk",
          },
        },
      }),
    );

    const provider = new CLIConfigCredentialProvider();
    const creds = await provider.resolveCredentials();

    expect(creds.accessKeyId).toBe("custom-ak");
    expect(creds.secretAccessKey).toBe("custom-sk");
    expect(creds.sessionToken).toBeUndefined();
  });

  it("should use USERPROFILE on Windows when HOME is not set", async () => {
    delete process.env.HOME;
    process.env.USERPROFILE = "C:\\Users\\test";

    (path.resolve as jest.Mock).mockReturnValue(
      "C:\\Users\\test\\.volcengine\\config.json",
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        current: "default",
        profiles: {
          default: {
            "access-key": "win-ak",
            "secret-key": "win-sk",
          },
        },
      }),
    );

    const provider = new CLIConfigCredentialProvider();
    const creds = await provider.resolveCredentials();

    expect(creds.accessKeyId).toBe("win-ak");
    expect(creds.secretAccessKey).toBe("win-sk");
  });

  it("should throw if HOME and USERPROFILE are both unset", async () => {
    delete process.env.HOME;
    delete process.env.USERPROFILE;

    const provider = new CLIConfigCredentialProvider();
    await expect(provider.resolveCredentials()).rejects.toThrow(
      "HOME / USERPROFILE 环境变量未设置",
    );
  });

  it("should throw if config file does not exist", async () => {
    process.env.HOME = "/mock/home";

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.volcengine/config.json",
    );
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const provider = new CLIConfigCredentialProvider();
    await expect(provider.resolveCredentials()).rejects.toThrow(
      "配置文件不存在",
    );
  });

  it("should throw friendly error on invalid JSON", async () => {
    process.env.HOME = "/mock/home";

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.volcengine/config.json",
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue("{ invalid json }");

    const provider = new CLIConfigCredentialProvider();
    await expect(provider.resolveCredentials()).rejects.toThrow(
      "解析配置文件失败",
    );
  });

  it("should throw if no valid profile found", async () => {
    process.env.HOME = "/mock/home";

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.volcengine/config.json",
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({ profiles: {}, current: "nonexistent" }),
    );

    const provider = new CLIConfigCredentialProvider();
    await expect(provider.resolveCredentials()).rejects.toThrow(
      "未找到有效的 profile",
    );
  });

  it("should throw if profile is missing access-key or secret-key", async () => {
    process.env.HOME = "/mock/home";

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.volcengine/config.json",
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        current: "default",
        profiles: { default: { "access-key": "ak-only" } },
      }),
    );

    const provider = new CLIConfigCredentialProvider();
    await expect(provider.resolveCredentials()).rejects.toThrow(
      "缺少 access-key 或 secret-key",
    );
  });
});
