import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { buildAuthToken } from "../src/feature/rds/connect";
import { Client } from "../src";

describe("RDS Connect Utils", () => {
  describe("buildAuthToken", () => {
    const envKeysToClear = [
      "VOLCSTACK_ACCESS_KEY_ID",
      "VOLCSTACK_ACCESS_KEY",
      "VOLCSTACK_SECRET_ACCESS_KEY",
      "VOLCSTACK_SECRET_KEY",
      "VOLCSTACK_SESSION_TOKEN",
    ] as const;

    const originalEnv: Record<string, string | undefined> = {};

    beforeAll(() => {
      for (const key of envKeysToClear) {
        originalEnv[key] = process.env[key];
        delete process.env[key];
      }
      originalEnv.HOME = process.env.HOME;
      process.env.HOME = "/__volcengine_nodejs_sdk_test_home__";
    });

    afterAll(() => {
      for (const key of envKeysToClear) {
        const originalValue = originalEnv[key];
        if (originalValue === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = originalValue;
        }
      }
      if (originalEnv.HOME === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = originalEnv.HOME;
      }
    });

    const validClientConfig = {
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      region: "cn-beijing",
    };

    const createClient = (overrides: Partial<Client["config"]> = {}) =>
      new Client({ ...validClientConfig, ...overrides });

    const validOptions = {
      dbUser: "admin",
      instanceId: "mysql-instance-123",
    };

    test("should return presigned auth token", async () => {
      const token = await buildAuthToken(createClient(), validOptions);
      expect(token).toContain("https://open.volcengineapi.com");

      // Should contain required parameters
      expect(token).toContain("Action=ConnectDatabase");
      expect(token).toContain("Version=2022-01-01");
      expect(token).toContain("DBUser=admin");
      expect(token).toContain("InstanceId=mysql-instance-123");
      expect(token).toContain("X-Expires=900");

      // Should contain signature parameters
      expect(token).toContain("X-Algorithm=HMAC-SHA256");
      expect(token).toContain("X-Credential=");
      expect(token).toContain("X-Date=");
      expect(token).toContain("X-Signature=");
    });

    test("should sign resolved host", async () => {
      const token = await buildAuthToken(createClient(), validOptions);
      expect(token).toContain("X-SignedHeaders=host");
    });

    test("should use different credential scope for different regions", async () => {
      const tokenBeijing = await buildAuthToken(createClient(), validOptions);
      const tokenShanghai = await buildAuthToken(
        createClient({ region: "cn-shanghai" }),
        validOptions,
      );

      expect(tokenBeijing).toContain("%2Fcn-beijing%2Frds_mysql%2Frequest");
      expect(tokenShanghai).toContain("%2Fcn-shanghai%2Frds_mysql%2Frequest");
    });

    test("should use custom expires value", async () => {
      const token = await buildAuthToken(createClient(), {
        ...validOptions,
        expires: 1800,
      });

      expect(token).toContain("X-Expires=1800");
    });

    test("should include security token when provided", async () => {
      const token = await buildAuthToken(
        createClient({ sessionToken: "session-token-abc" }),
        validOptions,
      );

      expect(token).toContain("X-Security-Token=session-token-abc");
    });

    test("should throw error when accessKeyId is empty", async () => {
      await expect(
        buildAuthToken(createClient({ accessKeyId: "" }), validOptions),
      ).rejects.toThrow(
        "Access key ID, secret access key, and region must not be empty",
      );
    });

    test("should throw error when secretAccessKey is empty", async () => {
      await expect(
        buildAuthToken(createClient({ secretAccessKey: "" }), validOptions),
      ).rejects.toThrow(
        "Access key ID, secret access key, and region must not be empty",
      );
    });

    test("should throw error when region is empty", async () => {
      await expect(
        buildAuthToken(createClient({ region: "" }), validOptions),
      ).rejects.toThrow(
        "Access key ID, secret access key, and region must not be empty",
      );
    });

    test("should throw error when dbUser is empty", async () => {
      await expect(
        buildAuthToken(createClient(), { ...validOptions, dbUser: "" }),
      ).rejects.toThrow("DBUser and InstanceId must not be empty");
    });

    test("should throw error when instanceId is empty", async () => {
      await expect(
        buildAuthToken(createClient(), { ...validOptions, instanceId: "" }),
      ).rejects.toThrow("DBUser and InstanceId must not be empty");
    });

    test("should throw error when expires is not a positive integer", async () => {
      await expect(
        buildAuthToken(createClient(), { ...validOptions, expires: 0 }),
      ).rejects.toThrow("Expires must be a positive integer");
      await expect(
        buildAuthToken(createClient(), { ...validOptions, expires: -100 }),
      ).rejects.toThrow("Expires must be a positive integer");
    });

    test("should handle special characters in dbUser", async () => {
      const token = await buildAuthToken(createClient(), {
        ...validOptions,
        dbUser: "user@domain",
      });
      expect(token).toContain("DBUser=user%40domain");
    });
  });
});
