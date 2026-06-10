import fs from "fs";
import crypto from "crypto";
import path from "path";
import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

const mockStsResolveCredentials = jest.fn<() => Promise<any>>();
const mockOidcResolveCredentials = jest.fn<() => Promise<any>>();
const mockEcsResolveCredentials = jest.fn<() => Promise<any>>();
const mockStsAssumeRoleProvider = jest.fn().mockImplementation(() => ({
  providerName: "StsAssumeRoleProvider",
  resolveCredentials: mockStsResolveCredentials,
}));
const mockOidcCredentialProvider = jest.fn().mockImplementation(() => ({
  providerName: "OidcCredentialProvider",
  resolveCredentials: mockOidcResolveCredentials,
}));
const mockEcsRoleCredentialProvider = jest.fn().mockImplementation(() => ({
  providerName: "EcsRoleCredentialProvider",
  resolveCredentials: mockEcsResolveCredentials,
}));

jest.mock("fs");
jest.mock("path");
jest.mock("../../src/credentials/StsAssumeRoleProvider", () => ({
  StsAssumeRoleProvider: mockStsAssumeRoleProvider,
}));
jest.mock("../../src/credentials/OidcCredentialProvider", () => ({
  OidcCredentialProvider: mockOidcCredentialProvider,
}));
jest.mock("../../src/credentials/EcsRoleCredentialProvider", () => ({
  EcsRoleCredentialProvider: mockEcsRoleCredentialProvider,
}));

const {
  CLIConfigCredentialProvider,
} = require("../../src/credentials/CLIConfigCredentialProvider");

describe("CLIConfigCredentialProvider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.VOLCENGINE_CLI_CONFIG_FILE;
    delete process.env.VOLCENGINE_PROFILE;
    delete process.env.VOLCSTACK_PROFILE;
    jest.clearAllMocks();
    mockStsResolveCredentials.mockResolvedValue({
      accessKeyId: "sts-ak",
      secretAccessKey: "sts-sk",
      sessionToken: "sts-token",
      providerName: "StsAssumeRoleProvider",
    });
    mockOidcResolveCredentials.mockResolvedValue({
      accessKeyId: "oidc-ak",
      secretAccessKey: "oidc-sk",
      sessionToken: "oidc-token",
      providerName: "OidcCredentialProvider",
    });
    mockEcsResolveCredentials.mockResolvedValue({
      accessKeyId: "ecs-ak",
      secretAccessKey: "ecs-sk",
      sessionToken: "ecs-token",
      providerName: "EcsRoleCredentialProvider",
    });
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

  it("should select profile from VOLCENGINE_PROFILE", async () => {
    process.env.HOME = "/mock/home";
    process.env.VOLCENGINE_PROFILE = "prod";

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.volcengine/config.json",
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        current: "default",
        profiles: {
          default: {
            "access-key": "default-ak",
            "secret-key": "default-sk",
          },
          prod: {
            "access-key": "prod-ak",
            "secret-key": "prod-sk",
          },
        },
      }),
    );

    const provider = new CLIConfigCredentialProvider();
    const creds = await provider.resolveCredentials();

    expect(creds.accessKeyId).toBe("prod-ak");
    expect(creds.secretAccessKey).toBe("prod-sk");
  });

  it("should delegate ramrolearn mode to StsAssumeRoleProvider", async () => {
    process.env.HOME = "/mock/home";

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.volcengine/config.json",
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        current: "ram",
        profiles: {
          ram: {
            mode: "RamRoleArn",
            "access-key": "base-ak",
            "secret-key": "base-sk",
            "session-token": "base-token",
            "account-id": "2000012345",
            "role-name": "demo-role",
            region: "cn-shanghai",
            "disable-ssl": true,
          },
        },
      }),
    );

    const provider = new CLIConfigCredentialProvider();
    const creds = await provider.resolveCredentials();

    expect(mockStsAssumeRoleProvider).toHaveBeenCalledWith({
      accessKeyId: "base-ak",
      secretAccessKey: "base-sk",
      roleTrn: "trn:iam::2000012345:role/demo-role",
      region: "cn-shanghai",
      protocol: "http",
      durationSeconds: 3600,
    });
    expect(creds.providerName).toBe("StsAssumeRoleProvider");
  });

  it("should delegate oidc mode to OidcCredentialProvider", async () => {
    process.env.HOME = "/mock/home";

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.volcengine/config.json",
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        current: "oidc",
        profiles: {
          oidc: {
            mode: "OIDC",
            "role-trn": "trn:iam::2000012345:role/oidc-role",
            "oidc-token-file": "/tmp/oidc-token",
          },
        },
      }),
    );

    const provider = new CLIConfigCredentialProvider();
    const creds = await provider.resolveCredentials();

    expect(mockOidcCredentialProvider).toHaveBeenCalledWith({
      roleTrn: "trn:iam::2000012345:role/oidc-role",
      oidcTokenFile: "/tmp/oidc-token",
      region: "cn-beijing",
      protocol: "https",
      durationSeconds: 3600,
    });
    expect(creds.providerName).toBe("OidcCredentialProvider");
  });

  it("should delegate ecsrole mode to EcsRoleCredentialProvider", async () => {
    process.env.HOME = "/mock/home";

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.volcengine/config.json",
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        current: "ecs",
        profiles: {
          ecs: {
            mode: "ecsrole",
            "role-name": "ecs-role",
          },
        },
      }),
    );

    const provider = new CLIConfigCredentialProvider();
    const creds = await provider.resolveCredentials();

    expect(mockEcsRoleCredentialProvider).toHaveBeenCalledWith({
      roleName: "ecs-role",
    });
    expect(creds.providerName).toBe("EcsRoleCredentialProvider");
  });

  it("should resolve valid StsToken mode from cached temporary credentials", async () => {
    process.env.HOME = "/mock/home";

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.volcengine/config.json",
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        current: "sts",
        profiles: {
          sts: {
            mode: "StsToken",
            "access-key": "tmp-ak",
            "secret-key": "tmp-sk",
            "session-token": "tmp-token",
            "sts-expiration": Date.now() + 60 * 60 * 1000,
          },
        },
      }),
    );

    const provider = new CLIConfigCredentialProvider();
    const creds = await provider.resolveCredentials();

    expect(creds).toEqual({
      accessKeyId: "tmp-ak",
      secretAccessKey: "tmp-sk",
      sessionToken: "tmp-token",
      providerName: "CLIConfigCredentialProvider",
    });
  });

  it("should resolve console-login credentials from login cache", async () => {
    process.env.HOME = "/mock/home";
    process.env.VOLCENGINE_LOGIN_CACHE_DIRECTORY = "/mock/login/cache";
    const loginSession = "console-session";
    const cachePath = `/mock/login/cache/${crypto
      .createHash("sha1")
      .update(loginSession)
      .digest("hex")}.json`;

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.volcengine/config.json",
    );
    (path.join as jest.Mock).mockImplementation((...parts: unknown[]) =>
      parts.join("/"),
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockImplementation((filePath: unknown) => {
      if (filePath === "/mock/home/.volcengine/config.json") {
        return JSON.stringify({
          current: "console",
          profiles: {
            console: {
              mode: "console-login",
              "login-session": loginSession,
            },
          },
        });
      }
      if (filePath === cachePath) {
        return JSON.stringify({
          access_token: JSON.stringify({
            access_key_id: "login-ak",
            secret_access_key: "login-sk",
            session_token: "login-token",
          }),
          issued_at: new Date().toISOString(),
          expires_in: 3600,
          refresh_token: "login-refresh-token",
          client_id: "login-client-id",
        });
      }
      throw new Error(`unexpected read: ${filePath}`);
    });

    const provider = new CLIConfigCredentialProvider();
    const creds = await provider.resolveCredentials();

    expect(creds).toEqual({
      accessKeyId: "login-ak",
      secretAccessKey: "login-sk",
      sessionToken: "login-token",
      providerName: "CLIConfigCredentialProvider",
    });
  });

  it("should cache StsToken credentials and skip re-reading config file on subsequent calls", async () => {
    process.env.HOME = "/mock/home";

    (path.resolve as jest.Mock).mockReturnValue(
      "/mock/home/.volcengine/config.json",
    );
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        current: "sts",
        profiles: {
          sts: {
            mode: "StsToken",
            "access-key": "tmp-ak",
            "secret-key": "tmp-sk",
            "session-token": "tmp-token",
            "sts-expiration": Math.floor((Date.now() + 60 * 60 * 1000) / 1000),
          },
        },
      }),
    );

    const provider = new CLIConfigCredentialProvider();
    const first = await provider.resolveCredentials();
    const second = await provider.resolveCredentials();

    expect(first).toEqual(second);
    // 第一次读配置，第二次应命中 delegate 缓存，不再调用 readFileSync
    expect((fs.readFileSync as jest.Mock).mock.calls.length).toBe(1);
  });
});
