import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterAll,
} from "@jest/globals";
import fs from "fs";
import path from "path";
import { loadEnv, loadEnvFromProcess, loadNodeConfig } from "../src/utils/env";

// Mock fs and path modules
jest.mock("fs");
jest.mock("path");

describe("Env Utils", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
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
    delete process.env.VOLC_ENABLE_DUALSTACK;
    delete process.env.VOLC_BOOTSTRAP_REGION_LIST_CONF;
    delete process.env.VOLCENGINE_OIDC_ROLE_TRN;
    delete process.env.VOLCENGINE_OIDC_ROLE_SESSION_NAME;
    delete process.env.VOLCENGINE_OIDC_TOKEN_FILE;
    delete process.env.VOLCENGINE_OIDC_STS_ENDPOINT;
    delete process.env.VOLCENGINE_OIDC_ROLE_POLICY;
    delete process.env.VOLCENGINE_ECS_METADATA;
    delete process.env.VOLCENGINE_ECS_METADATA_DISABLED;
    delete process.env.VOLCENGINE_CLI_CONFIG_FILE;
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("loadEnvFromProcess", () => {
    it("should load credentials from VOLCSTACK standard environment variables", () => {
      process.env.VOLCSTACK_ACCESS_KEY_ID = "ak-test";
      process.env.VOLCSTACK_SECRET_ACCESS_KEY = "sk-test";
      process.env.VOLCSTACK_SESSION_TOKEN = "token-test";

      const config = loadEnvFromProcess();

      expect(config.credentials.accessKeyId).toBe("ak-test");
      expect(config.credentials.secretAccessKey).toBe("sk-test");
      expect(config.credentials.sessionToken).toBe("token-test");
    });

    it("should load credentials from VOLCSTACK alias environment variables", () => {
      process.env.VOLCSTACK_ACCESS_KEY = "ak-alias";
      process.env.VOLCSTACK_SECRET_KEY = "sk-alias";

      const config = loadEnvFromProcess();

      expect(config.credentials.accessKeyId).toBe("ak-alias");
      expect(config.credentials.secretAccessKey).toBe("sk-alias");
      expect(config.credentials.sessionToken).toBeUndefined();
    });

    it("should prioritize VOLCENGINE_* over VOLCSTACK_*", () => {
      process.env.VOLCENGINE_ACCESS_KEY = "ak-volcengine";
      process.env.VOLCENGINE_SECRET_KEY = "sk-volcengine";
      process.env.VOLCENGINE_SESSION_TOKEN = "token-volcengine";
      process.env.VOLCSTACK_ACCESS_KEY_ID = "ak-volcstack";
      process.env.VOLCSTACK_SECRET_ACCESS_KEY = "sk-volcstack";
      process.env.VOLCSTACK_SESSION_TOKEN = "token-volcstack";

      const config = loadEnvFromProcess();

      expect(config.credentials.accessKeyId).toBe("ak-volcengine");
      expect(config.credentials.secretAccessKey).toBe("sk-volcengine");
      expect(config.credentials.sessionToken).toBe("token-volcengine");
    });

    it("should prioritize VOLCSTACK standard keys over aliases", () => {
      process.env.VOLCSTACK_ACCESS_KEY_ID = "ak-standard";
      process.env.VOLCSTACK_ACCESS_KEY = "ak-alias";
      process.env.VOLCSTACK_SECRET_ACCESS_KEY = "sk-standard";
      process.env.VOLCSTACK_SECRET_KEY = "sk-alias";

      const config = loadEnvFromProcess();

      expect(config.credentials.accessKeyId).toBe("ak-standard");
      expect(config.credentials.secretAccessKey).toBe("sk-standard");
    });

    it("should load OIDC env vars into credentials.assumeRoleWithOIDC", () => {
      process.env.VOLCENGINE_OIDC_ROLE_TRN = "trn:iam::123456:role/my-role";
      process.env.VOLCENGINE_OIDC_TOKEN_FILE = "/path/to/token";
      process.env.VOLCENGINE_OIDC_STS_ENDPOINT = "sts.custom.com";
      process.env.VOLCENGINE_OIDC_ROLE_POLICY = "my-policy";

      const config = loadEnvFromProcess();

      expect(config.credentials.assumeRoleWithOIDC).toEqual({
        roleTrn: "trn:iam::123456:role/my-role",
        roleSessionName: undefined,
        oidcTokenFile: "/path/to/token",
        host: "sts.custom.com",
        policy: "my-policy",
      });
    });

    it("should NOT set assumeRoleWithOIDC if OIDC env vars are incomplete", () => {
      process.env.VOLCENGINE_OIDC_ROLE_TRN = "trn:iam::123456:role/my-role";
      // 缺少 VOLCENGINE_OIDC_TOKEN_FILE

      const config = loadEnvFromProcess();
      expect(config.credentials.assumeRoleWithOIDC).toBeUndefined();
    });

    it("should load ECS role env vars into credentials.ecsRole", () => {
      process.env.VOLCENGINE_ECS_METADATA = "ecs-role-name";

      const config = loadEnvFromProcess();

      expect(config.credentials.ecsRole).toEqual({
        roleName: "ecs-role-name",
        disabled: false,
      });
    });

    it("should set ecsRole.disabled when VOLCENGINE_ECS_METADATA_DISABLED=true", () => {
      process.env.VOLCENGINE_ECS_METADATA = "ecs-role-name";
      process.env.VOLCENGINE_ECS_METADATA_DISABLED = "true";

      const config = loadEnvFromProcess();
      expect(config.credentials.ecsRole?.disabled).toBe(true);
    });

    it("should load CLI config file path env var", () => {
      process.env.VOLCENGINE_CLI_CONFIG_FILE = "/custom/config.json";

      const config = loadEnvFromProcess();
      expect(config.credentials.configFilePath).toBe("/custom/config.json");
    });

    it("should load dualstack config", () => {
      process.env.VOLC_ENABLE_DUALSTACK = "true";
      const configTrue = loadEnvFromProcess();
      expect(configTrue.enableDualstack).toBe(true);

      process.env.VOLC_ENABLE_DUALSTACK = "false";
      const configFalse = loadEnvFromProcess();
      expect(configFalse.enableDualstack).toBe(false);

      delete process.env.VOLC_ENABLE_DUALSTACK;
      const configUndefined = loadEnvFromProcess();
      expect(configUndefined.enableDualstack).toBe(false);
    });

    it("should load bootstrap region list config", () => {
      process.env.VOLC_BOOTSTRAP_REGION_LIST_CONF = "/path/to/conf";
      const config = loadEnvFromProcess();
      expect(config.bootstrapRegionListConf).toBe("/path/to/conf");
    });
  });

  describe("loadEnv", () => {
    it("should return same result as loadEnvFromProcess", () => {
      process.env.VOLCSTACK_ACCESS_KEY_ID = "ak-env";
      process.env.VOLCSTACK_SECRET_ACCESS_KEY = "sk-env";

      const envConfig = loadEnv();
      const processConfig = loadEnvFromProcess();

      expect(envConfig.credentials.accessKeyId).toBe("ak-env");
      expect(envConfig.credentials.secretAccessKey).toBe("sk-env");
      expect(envConfig).toEqual(processConfig);
    });

    it("should return undefined credentials when env vars are not set", () => {
      const config = loadEnv();

      expect(config.credentials.accessKeyId).toBeUndefined();
      expect(config.credentials.secretAccessKey).toBeUndefined();
    });
  });

  describe("loadNodeConfig", () => {
    it("should load credentials from ~/.volc/config", () => {
      process.env.HOME = "/mock/home";

      (path.resolve as jest.Mock).mockReturnValue("/mock/home/.volc/config");
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({
          VOLC_ACCESSKEY: "ak-file",
          VOLC_SECRETKEY: "sk-file",
        }),
      );

      const config = loadNodeConfig();

      expect(path.resolve).toHaveBeenCalledWith("/mock/home", ".volc/config");
      expect(config.accessKeyId).toBe("ak-file");
      expect(config.secretAccessKey).toBe("sk-file");
    });

    it("should return empty object if config file does not exist", () => {
      process.env.HOME = "/mock/home";

      (path.resolve as jest.Mock).mockReturnValue("/mock/home/.volc/config");
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const config = loadNodeConfig();

      expect(config.accessKeyId).toBeUndefined();
      expect(config.secretAccessKey).toBeUndefined();
    });

    it("should return undefined if HOME is not set", () => {
      delete process.env.HOME;

      const config = loadNodeConfig();
      expect(config).toBeUndefined();
    });
  });
});
