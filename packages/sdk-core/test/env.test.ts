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
import { loadEnv, loadEnvFromProcess } from "../src/utils/env";

// Mock fs and path modules
jest.mock("fs");
jest.mock("path");

describe("Env Utils", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("loadEnvFromProcess", () => {
    it("should load credentials from standard environment variables", () => {
      process.env.VOLCSTACK_ACCESS_KEY_ID = "accessKeyId-test";
      process.env.VOLCSTACK_SECRET_ACCESS_KEY = "secretAccessKey-test";
      process.env.VOLCSTACK_SESSION_TOKEN = "token-test";

      const config = loadEnvFromProcess();

      expect(config.credentials).toEqual({
        accessKeyId: "accessKeyId-test",
        secretAccessKey: "secretAccessKey-test",
        sessionToken: "token-test",
      });
    });

    it("should load credentials from alias environment variables", () => {
      process.env.VOLCSTACK_ACCESS_KEY = "accessKeyId-alias";
      process.env.VOLCSTACK_SECRET_KEY = "secretAccessKey-alias";

      const config = loadEnvFromProcess();

      expect(config.credentials).toEqual({
        accessKeyId: "accessKeyId-alias",
        secretAccessKey: "secretAccessKey-alias",
        sessionToken: undefined,
      });
    });

    it("should prioritize standard keys over aliases", () => {
      process.env.VOLCSTACK_ACCESS_KEY_ID = "accessKeyId-standard";
      process.env.VOLCSTACK_ACCESS_KEY = "accessKeyId-alias";
      process.env.VOLCSTACK_SECRET_ACCESS_KEY = "secretAccessKey-standard";
      process.env.VOLCSTACK_SECRET_KEY = "secretAccessKey-alias";

      const config = loadEnvFromProcess();

      expect(config.credentials).toEqual({
        accessKeyId: "accessKeyId-standard",
        secretAccessKey: "secretAccessKey-standard",
        sessionToken: undefined,
      });
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
    it("should return process env config if credentials exist", () => {
      process.env.VOLCSTACK_ACCESS_KEY_ID = "accessKeyId-env";
      process.env.VOLCSTACK_SECRET_ACCESS_KEY = "secretAccessKey-env";

      const config = loadEnv();

      expect(config.credentials.accessKeyId).toBe("accessKeyId-env");
      expect(config.credentials.secretAccessKey).toBe("secretAccessKey-env");
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it("should load from ~/.volc/config if credentials missing in env", () => {
      // Setup environment
      process.env.HOME = "/mock/home";
      delete process.env.VOLCSTACK_ACCESS_KEY_ID;
      delete process.env.VOLCSTACK_SECRET_ACCESS_KEY;
      delete process.env.VOLCSTACK_ACCESS_KEY;
      delete process.env.VOLCSTACK_SECRET_KEY;

      // Mock path.resolve
      (path.resolve as jest.Mock).mockReturnValue("/mock/home/.volc/config");

      // Mock fs
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({
          VOLC_ACCESSKEY: "accessKeyId-file",
          VOLC_SECRETKEY: "secretAccessKey-file",
        })
      );

      const config = loadEnv();

      expect(path.resolve).toHaveBeenCalledWith("/mock/home", ".volc/config");
      expect(fs.readFileSync).toHaveBeenCalledWith("/mock/home/.volc/config", {
        encoding: "utf-8",
      });
      expect(config.credentials.accessKeyId).toBe("accessKeyId-file");
      expect(config.credentials.secretAccessKey).toBe("secretAccessKey-file");
    });

    it("should partially load from file if one credential missing in env", () => {
      process.env.HOME = "/mock/home";
      process.env.VOLCSTACK_ACCESS_KEY_ID = "accessKeyId-env";
      delete process.env.VOLCSTACK_SECRET_ACCESS_KEY;

      (path.resolve as jest.Mock).mockReturnValue("/mock/home/.volc/config");
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({
          VOLC_ACCESSKEY: "accessKeyId-file",
          VOLC_SECRETKEY: "secretAccessKey-file",
        })
      );

      const config = loadEnv();

      // Logic in loadEnv checks: !(envConfig.credentials.accessKeyId && envConfig.credentials.secretAccessKey)
      // Here accessKeyId is present, secretAccessKey is missing. So it enters the block.
      // Then: if (!envConfig.credentials.accessKeyId && configData.VOLC_ACCESSKEY) -> False, keeps accessKeyId-env
      // Then: if (!envConfig.credentials.secretAccessKey && configData.VOLC_SECRETKEY) -> True, takes secretAccessKey-file

      expect(config.credentials.accessKeyId).toBe("accessKeyId-env");
      expect(config.credentials.secretAccessKey).toBe("secretAccessKey-file");
    });

    it("should not fail if config file does not exist", () => {
      process.env.HOME = "/mock/home";
      delete process.env.VOLCSTACK_ACCESS_KEY_ID;
      delete process.env.VOLCSTACK_SECRET_ACCESS_KEY;

      (path.resolve as jest.Mock).mockReturnValue("/mock/home/.volc/config");
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const config = loadEnv();

      expect(config.credentials.accessKeyId).toBeUndefined();
      expect(config.credentials.secretAccessKey).toBeUndefined();
    });

    it("should not fail if HOME is undefined", () => {
      delete process.env.HOME;
      delete process.env.VOLCSTACK_ACCESS_KEY_ID;
      delete process.env.VOLCSTACK_SECRET_ACCESS_KEY;

      const config = loadEnv();

      expect(config.credentials.accessKeyId).toBeUndefined();
      expect(config.credentials.secretAccessKey).toBeUndefined();
      expect(fs.existsSync).not.toHaveBeenCalled();
    });
  });
});
