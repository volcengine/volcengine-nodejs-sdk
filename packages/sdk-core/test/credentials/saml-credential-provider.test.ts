import { SamlCredentialProvider } from "../../src/credentials/SamlCredentialProvider";

// Mock the dynamic import of stsClient
const mockSend = jest.fn();
jest.mock("../../src/client/stsClient", () => ({
  STSClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  AssumeRoleWithSAMLCommand: jest.fn().mockImplementation((input: any) => input),
}));

function makeParams(suffix: string) {
  return {
    roleTrn: `trn:iam::2000012345:role/saml-${suffix}`,
    accountId: "2000012345",
    samlProviderTrn: `trn:iam::2000012345:saml-provider/idp-${suffix}`,
    samlAssertion: `assertion-${suffix}`,
  };
}

function buildMockResponse() {
  const now = Date.now();
  return {
    ResponseMetadata: {
      RequestId: "req-saml-1",
      Action: "AssumeRoleWithSAML",
      Version: "2018-01-01",
      Service: "sts",
      Region: "cn-beijing",
    },
    Result: {
      Credentials: {
        AccessKeyId: "ak-saml-1",
        SecretAccessKey: "sk-saml-1",
        SessionToken: "token-saml-1",
        ExpiredTime: new Date(now + 3600 * 1000).toISOString(),
      },
      SAMLAssertionInfo: {
        SubjectType: "persistent",
        Subject: "user@example.com",
        Issuer: "https://idp.example.com",
        Recipient: "https://sts.volcengineapi.com",
      },
      AssumedRoleUser: {
        Trn: "trn:sts::2000012345:assumed-role/test-role/session",
        AssumedRoleId: "role-id-123:session",
      },
    },
  };
}

describe("SamlCredentialProvider", () => {
  beforeEach(() => {
    // mockReset clears both call history AND accumulated one-time implementations
    mockSend.mockReset();
  });

  describe("constructor validation", () => {
    it("should throw if required params are missing", () => {
      expect(() => new SamlCredentialProvider({} as any)).toThrow(
        "SamlCredentialProvider: roleTrn, accountId, samlProviderTrn, samlAssertion 为必填项",
      );
    });

    it("should throw if roleTrn is missing", () => {
      expect(
        () => new SamlCredentialProvider({ ...makeParams("x"), roleTrn: "" }),
      ).toThrow("SamlCredentialProvider");
    });

    it("should throw if accountId is missing", () => {
      expect(
        () => new SamlCredentialProvider({ ...makeParams("x"), accountId: "" }),
      ).toThrow("SamlCredentialProvider");
    });

    it("should throw if samlProviderTrn is missing", () => {
      expect(
        () => new SamlCredentialProvider({ ...makeParams("x"), samlProviderTrn: "" }),
      ).toThrow("SamlCredentialProvider");
    });

    it("should throw if samlAssertion is missing", () => {
      expect(
        () => new SamlCredentialProvider({ ...makeParams("x"), samlAssertion: "" }),
      ).toThrow("SamlCredentialProvider");
    });

    it("should succeed with valid params", () => {
      expect(() => new SamlCredentialProvider(makeParams("valid"))).not.toThrow();
    });
  });

  describe("resolveCredentials", () => {
    it("should call STSClient with correct params and return credentials", async () => {
      mockSend.mockResolvedValueOnce(buildMockResponse());

      const params = makeParams("call-test");
      const provider = new SamlCredentialProvider(params);
      const creds = await provider.resolveCredentials();

      expect(creds.accessKeyId).toBe("ak-saml-1");
      expect(creds.secretAccessKey).toBe("sk-saml-1");
      expect(creds.sessionToken).toBe("token-saml-1");
      expect(creds.providerName).toBe("SamlCredentialProvider");

      const { AssumeRoleWithSAMLCommand } = require("../../src/client/stsClient");
      expect(AssumeRoleWithSAMLCommand).toHaveBeenCalledWith({
        DurationSeconds: 3600,
        RoleTrn: params.roleTrn,
        SAMLProviderTrn: params.samlProviderTrn,
        SAMLResp: params.samlAssertion,
        Policy: undefined,
      });
    });

    it("should cache credentials and reuse result", async () => {
      mockSend.mockResolvedValueOnce(buildMockResponse());

      // Use unique params so no cache hit from other tests
      const provider = new SamlCredentialProvider(makeParams("cache-test"));
      const c1 = await provider.resolveCredentials();
      const c2 = await provider.resolveCredentials();

      expect(c1).toBe(c2);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("should merge concurrent requests", async () => {
      mockSend.mockResolvedValueOnce(buildMockResponse());

      const provider = new SamlCredentialProvider(makeParams("concurrent-test"));

      const [c1, c2] = await Promise.all([
        provider.resolveCredentials(),
        provider.resolveCredentials(),
      ]);

      expect(c1).toBe(c2);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("should use custom durationSeconds when provided", async () => {
      mockSend.mockResolvedValueOnce(buildMockResponse());

      const provider = new SamlCredentialProvider({
        ...makeParams("duration-test"),
        durationSeconds: 7200,
      });
      await provider.resolveCredentials();

      const { AssumeRoleWithSAMLCommand } = require("../../src/client/stsClient");
      expect(AssumeRoleWithSAMLCommand).toHaveBeenCalledWith(
        expect.objectContaining({ DurationSeconds: 7200 }),
      );
    });

    it("should pass policy when provided", async () => {
      mockSend.mockResolvedValueOnce(buildMockResponse());

      const policy = '{"Statement":[{"Effect":"Allow","Action":["iam:GetUser"],"Resource":["*"]}]}';
      const provider = new SamlCredentialProvider({
        ...makeParams("policy-test"),
        policy,
      });
      await provider.resolveCredentials();

      const { AssumeRoleWithSAMLCommand } = require("../../src/client/stsClient");
      expect(AssumeRoleWithSAMLCommand).toHaveBeenCalledWith(
        expect.objectContaining({ Policy: policy }),
      );
    });

    it("should clean up pending requests on failure", async () => {
      mockSend.mockRejectedValueOnce(new Error("STS request failed"));

      const params = makeParams("failure-test");
      const provider = new SamlCredentialProvider(params);

      await expect(provider.resolveCredentials()).rejects.toThrow(
        "STS request failed",
      );

      // Second call should trigger a new request (not hang on pending)
      mockSend.mockResolvedValueOnce(buildMockResponse());
      const creds = await provider.resolveCredentials();
      expect(creds.accessKeyId).toBe("ak-saml-1");
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

});
