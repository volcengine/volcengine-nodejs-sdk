// Mock fs — must be before import
const mockReadFile = jest.fn().mockResolvedValue("mock-oidc-token-content");
jest.mock("fs", () => ({
  promises: {
    readFile: mockReadFile,
  },
}));

// Mock uuid
jest.mock("uuid", () => ({
  v4: jest.fn().mockReturnValue("mock-uuid-1234"),
}));

// Mock the dynamic import of stsClient
const mockSend = jest.fn();
jest.mock("../../src/client/stsClient", () => ({
  STSClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  AssumeRoleWithOIDCCommand: jest.fn().mockImplementation((input: any) => input),
}));

// Mock loadEnv for environment variable tests
jest.mock("../../src/utils/env", () => ({
  loadEnv: jest.fn(),
}));

// Import AFTER all mocks
import { OidcCredentialProvider } from "../../src/credentials/OidcCredentialProvider";

/**
 * Generate unique params per test to avoid module-level cache collisions.
 */
function makeParams(suffix: string) {
  return {
    roleTrn: `trn:iam::2000012345:role/oidc-${suffix}`,
    oidcTokenFile: `/path/to/oidc-token-${suffix}`,
  };
}

function buildMockResponse() {
  const now = Date.now();
  return {
    ResponseMetadata: {
      RequestId: "req-oidc-1",
      Action: "AssumeRoleWithOIDC",
      Version: "2018-01-01",
      Service: "sts",
      Region: "cn-beijing",
    },
    Result: {
      Credentials: {
        AccessKeyId: "ak-oidc-1",
        SecretAccessKey: "sk-oidc-1",
        SessionToken: "token-oidc-1",
        ExpiredTime: new Date(now + 3600 * 1000).toISOString(),
      },
      OIDCTokenInfo: {
        Subject: "user-sub-123",
        Issuer: "https://oidc.example.com",
        ClientIds: ["client-id-1"],
        ExpirationTime: "2026-04-10T04:00:00Z",
        IssuanceTime: "2026-04-10T03:00:00Z",
      },
      AssumedRoleUser: {
        Trn: "trn:sts::2000012345:assumed-role/oidc-role/session",
        AssumedRoleId: "role-id-456:session",
      },
    },
  };
}

describe("OidcCredentialProvider", () => {
  beforeEach(() => {
    // mockReset clears both call history AND accumulated one-time implementations,
    // preventing unconsumed mockResolvedValueOnce from leaking across tests.
    mockSend.mockReset();
    mockReadFile.mockReset();
    mockReadFile.mockResolvedValue("mock-oidc-token-content");
  });

  describe("constructor validation", () => {
    it("should throw if roleTrn is missing", () => {
      expect(
        () =>
          new OidcCredentialProvider({
            roleTrn: "",
            oidcTokenFile: "/path/to/token",
          }),
      ).toThrow("OidcCredentialProvider: RoleTrn 和 oidcTokenFile 为必填项");
    });

    it("should throw if oidcTokenFile is missing", () => {
      expect(
        () =>
          new OidcCredentialProvider({
            roleTrn: "trn:iam::123:role/test",
            oidcTokenFile: "",
          }),
      ).toThrow("OidcCredentialProvider: RoleTrn 和 oidcTokenFile 为必填项");
    });

    it("should succeed with valid params", () => {
      expect(() => new OidcCredentialProvider(makeParams("ctor"))).not.toThrow();
    });
  });

  describe("resolveCredentials", () => {
    it("should read OIDC token file asynchronously, call STSClient, and return credentials", async () => {
      mockSend.mockResolvedValueOnce(buildMockResponse());

      const params = makeParams("read-test");
      const provider = new OidcCredentialProvider(params);
      const creds = await provider.resolveCredentials();

      expect(creds.accessKeyId).toBe("ak-oidc-1");
      expect(creds.secretAccessKey).toBe("sk-oidc-1");
      expect(creds.sessionToken).toBe("token-oidc-1");
      expect(creds.providerName).toBe("OidcCredentialProvider");

      // Verify async file read
      expect(mockReadFile).toHaveBeenCalledWith(params.oidcTokenFile, "utf-8");

      // Verify command construction
      const { AssumeRoleWithOIDCCommand } = require("../../src/client/stsClient");
      expect(AssumeRoleWithOIDCCommand).toHaveBeenCalledWith({
        DurationSeconds: 3600,
        RoleTrn: params.roleTrn,
        RoleSessionName: "mock-uuid-1234",
        OIDCToken: "mock-oidc-token-content",
        Policy: undefined,
      });
    });

    it("should cache credentials and reuse result", async () => {
      mockSend.mockResolvedValueOnce(buildMockResponse());

      // Unique params to avoid cross-test cache collisions
      const provider = new OidcCredentialProvider(makeParams("cache-test"));
      const c1 = await provider.resolveCredentials();
      const c2 = await provider.resolveCredentials();

      expect(c1).toBe(c2);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("should merge concurrent requests", async () => {
      mockSend.mockResolvedValueOnce(buildMockResponse());

      const provider = new OidcCredentialProvider(makeParams("concurrent-test"));

      const [c1, c2] = await Promise.all([
        provider.resolveCredentials(),
        provider.resolveCredentials(),
      ]);

      expect(c1).toBe(c2);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("should use custom durationSeconds when provided", async () => {
      mockSend.mockResolvedValueOnce(buildMockResponse());

      const provider = new OidcCredentialProvider({
        ...makeParams("duration-test"),
        durationSeconds: 7200,
      });
      await provider.resolveCredentials();

      const { AssumeRoleWithOIDCCommand } = require("../../src/client/stsClient");
      expect(AssumeRoleWithOIDCCommand).toHaveBeenCalledWith(
        expect.objectContaining({ DurationSeconds: 7200 }),
      );
    });

    it("should use custom roleSessionName when provided", async () => {
      mockSend.mockResolvedValueOnce(buildMockResponse());

      const provider = new OidcCredentialProvider({
        ...makeParams("session-test"),
        roleSessionName: "my-custom-session",
      });
      await provider.resolveCredentials();

      const { AssumeRoleWithOIDCCommand } = require("../../src/client/stsClient");
      expect(AssumeRoleWithOIDCCommand).toHaveBeenCalledWith(
        expect.objectContaining({ RoleSessionName: "my-custom-session" }),
      );
    });

    it("should pass policy when provided", async () => {
      mockSend.mockResolvedValueOnce(buildMockResponse());

      const policy = '{"Statement":[{"Effect":"Allow","Action":["iam:GetUser"],"Resource":["*"]}]}';
      const provider = new OidcCredentialProvider({
        ...makeParams("policy-test"),
        policy,
      });
      await provider.resolveCredentials();

      const { AssumeRoleWithOIDCCommand } = require("../../src/client/stsClient");
      expect(AssumeRoleWithOIDCCommand).toHaveBeenCalledWith(
        expect.objectContaining({ Policy: policy }),
      );
    });

    it("should clean up pending requests on failure", async () => {
      mockSend.mockRejectedValueOnce(new Error("OIDC STS request failed"));

      const provider = new OidcCredentialProvider(makeParams("failure-test"));

      await expect(provider.resolveCredentials()).rejects.toThrow(
        "OIDC STS request failed",
      );

      // Second call should trigger a new request (not hang on pending)
      mockSend.mockResolvedValueOnce(buildMockResponse());
      const creds = await provider.resolveCredentials();
      expect(creds.accessKeyId).toBe("ak-oidc-1");
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe("environment variable fallback", () => {
    it("should throw when no params and env vars are not set", () => {
      const { loadEnv } = require("../../src/utils/env");
      (loadEnv as jest.Mock).mockReturnValue({
        credentials: { assumeRoleWithOIDC: undefined },
      });

      expect(() => new OidcCredentialProvider()).toThrow(
        "VOLCENGINE_OIDC_ROLE_TRN",
      );
    });
  });
});
