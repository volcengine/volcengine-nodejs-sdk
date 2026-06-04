import { EventEmitter } from "events";
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import http from "http";
import { EcsRoleCredentialProvider } from "../../src/credentials/EcsRoleCredentialProvider";

jest.mock("http");

const mockRequest = http.request as jest.MockedFunction<typeof http.request>;

interface MockResponse {
  statusCode?: number;
  body: string;
}

function mockHttpResponses(responses: MockResponse[]) {
  mockRequest.mockImplementation((options: any, callback?: any): any => {
    const response = responses.shift();
    if (!response) {
      throw new Error(`Unexpected IMDS request: ${options.path}`);
    }

    const req = new EventEmitter() as any;
    req.end = jest.fn(() => {
      const res = new EventEmitter() as any;
      res.statusCode = response.statusCode ?? 200;
      callback(res);
      process.nextTick(() => {
        res.emit("data", Buffer.from(response.body));
        res.emit("end");
      });
    });
    req.destroy = jest.fn((error?: Error) => {
      if (error) {
        req.emit("error", error);
      }
    });
    req.setTimeout = jest.fn();
    return req;
  });
}

describe("EcsRoleCredentialProvider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.VOLCENGINE_ECS_METADATA;
    delete process.env.VOLCENGINE_ECS_METADATA_DISABLED;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should auto detect roleName from IMDS when constructor and env are empty", async () => {
    mockHttpResponses([
      { body: "imdsv2-token" },
      { body: JSON.stringify(["auto-role", "backup-role"]) },
      {
        body: JSON.stringify({
          AccessKeyId: "ak",
          SecretAccessKey: "sk",
          SessionToken: "token",
          ExpiredTime: "2099-01-01T00:00:00Z",
        }),
      },
    ]);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const provider = new EcsRoleCredentialProvider({
      maxRetries: 1,
      retryInterval: 0,
    });

    const credentials = await provider.resolveCredentials();

    expect(credentials).toEqual({
      accessKeyId: "ak",
      secretAccessKey: "sk",
      sessionToken: "token",
      providerName: "EcsRoleCredentialProvider",
    });
    expect(mockRequest).toHaveBeenCalledTimes(3);
    expect(mockRequest.mock.calls[1][0]).toMatchObject({
      path: "/volcstack/latest/iam/security_credentials?type=user&format=json",
      method: "GET",
      headers: {
        "X-volc-ecs-metadata-token": "imdsv2-token",
      },
    });
    expect(mockRequest.mock.calls[2][0]).toMatchObject({
      path: "/volcstack/latest/iam/security_credentials/auto-role",
      method: "GET",
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("通过 IMDS 发现多个 IAM 角色"),
    );

    warnSpy.mockRestore();
  });

  it("should use env roleName before IMDS auto detection", async () => {
    process.env.VOLCENGINE_ECS_METADATA = "env-role";
    mockHttpResponses([
      { body: "imdsv2-token" },
      {
        body: JSON.stringify({
          AccessKeyId: "ak",
          SecretAccessKey: "sk",
          ExpiredTime: "2099-01-01T00:00:00Z",
        }),
      },
    ]);

    const provider = new EcsRoleCredentialProvider({
      maxRetries: 1,
      retryInterval: 0,
    });

    const credentials = await provider.resolveCredentials();

    expect(credentials.accessKeyId).toBe("ak");
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest.mock.calls[1][0]).toMatchObject({
      path: "/volcstack/latest/iam/security_credentials/env-role",
      method: "GET",
    });
  });
});
