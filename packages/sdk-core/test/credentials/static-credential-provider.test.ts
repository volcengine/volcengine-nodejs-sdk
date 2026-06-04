import { StaticCredentialProvider } from "../../src/credentials/StaticCredentialProvider";

describe("StaticCredentialProvider", () => {
  it("should return static credentials", async () => {
    const provider = new StaticCredentialProvider({
      accessKeyId: "ak-1",
      secretAccessKey: "sk-1",
    });
    const creds = await provider.resolveCredentials();

    expect(creds.accessKeyId).toBe("ak-1");
    expect(creds.secretAccessKey).toBe("sk-1");
    expect(creds.sessionToken).toBeUndefined();
    expect(creds.providerName).toBe("StaticCredentialProvider");
  });

  it("should return sessionToken when provided", async () => {
    const provider = new StaticCredentialProvider({
      accessKeyId: "ak-2",
      secretAccessKey: "sk-2",
      sessionToken: "token-2",
    });
    const creds = await provider.resolveCredentials();

    expect(creds.accessKeyId).toBe("ak-2");
    expect(creds.secretAccessKey).toBe("sk-2");
    expect(creds.sessionToken).toBe("token-2");
  });

  it("should throw if accessKeyId is missing", () => {
    expect(
      () =>
        new StaticCredentialProvider({
          accessKeyId: "",
          secretAccessKey: "sk",
        }),
    ).toThrow("accessKeyId and secretAccessKey are required");
  });

  it("should throw if secretAccessKey is missing", () => {
    expect(
      () =>
        new StaticCredentialProvider({
          accessKeyId: "ak",
          secretAccessKey: "",
        }),
    ).toThrow("accessKeyId and secretAccessKey are required");
  });

  it("should always return the same credentials", async () => {
    const provider = new StaticCredentialProvider({
      accessKeyId: "ak",
      secretAccessKey: "sk",
    });
    const c1 = await provider.resolveCredentials();
    const c2 = await provider.resolveCredentials();
    expect(c1).toBe(c2); // 同一引用
  });
});
