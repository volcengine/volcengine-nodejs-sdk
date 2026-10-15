import {
  describe,
  test,
  expect,
  beforeEach,
  afterAll,
  jest,
} from "@jest/globals";
import {
  resolveHttpOptions,
  parseProxyUrl,
  buildStsHttpOptions,
  assertCaFileReadable,
} from "../src/utils/proxy";
import { ClientConfig } from "../src/types/types";
import fs from "fs";
import os from "os";
import path from "path";

describe("resolveHttpOptions", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("should use provided proxy config if set", () => {
    const config: ClientConfig = {
      httpOptions: {
        proxy: {
          protocol: "http",
          host: "custom-proxy",
          port: 9090,
        },
      },
    };

    const result = resolveHttpOptions(config);
    expect(result?.proxy).toEqual({
      protocol: "http",
      host: "custom-proxy",
      port: 9090,
    });
  });

  test("should use environment variables if proxy config is not provided", () => {
    process.env.VOLC_PROXY_PROTOCOL = "http";
    process.env.VOLC_PROXY_HOST = "env-proxy";
    process.env.VOLC_PROXY_PORT = "1234";

    const config: ClientConfig = {};
    const result = resolveHttpOptions(config);

    expect(result?.proxy).toEqual({
      protocol: "http",
      host: "env-proxy",
      port: 1234,
    });
  });

  test("should use default port 80 if VOLC_PROXY_PORT is missing and protocol is http", () => {
    process.env.VOLC_PROXY_PROTOCOL = "http";
    process.env.VOLC_PROXY_HOST = "env-proxy-no-port";
    delete process.env.VOLC_PROXY_PORT;

    const config: ClientConfig = {};
    const result = resolveHttpOptions(config);

    expect(result?.proxy).toEqual({
      protocol: "http",
      host: "env-proxy-no-port",
      port: 80,
    });
  });

  test("should use default port 443 if VOLC_PROXY_PORT is missing and protocol is https", () => {
    process.env.VOLC_PROXY_PROTOCOL = "https";
    process.env.VOLC_PROXY_HOST = "env-proxy-secure";
    delete process.env.VOLC_PROXY_PORT;

    const config: ClientConfig = {};
    const result = resolveHttpOptions(config);

    expect(result?.proxy).toEqual({
      protocol: "https",
      host: "env-proxy-secure",
      port: 443,
    });
  });

  test("should not use proxy if env vars are missing and proxy config is not provided", () => {
    delete process.env.VOLC_PROXY_PROTOCOL;
    delete process.env.VOLC_PROXY_HOST;
    delete process.env.VOLC_PROXY_PORT;

    const config: ClientConfig = {};
    const result = resolveHttpOptions(config);

    expect(result).toBeUndefined();
  });

  test("should merge with existing httpOptions", () => {
    const config: ClientConfig = {
      httpOptions: {
        timeout: 5000,
      },
    };
    const result = resolveHttpOptions(config);

    expect(result?.timeout).toBe(5000);
    expect(result?.proxy).toBeUndefined();
  });
});

describe("parseProxyUrl", () => {
  test("should parse proxy url without auth", () => {
    const result = parseProxyUrl("http://10.0.0.1:8080");

    expect(result).toEqual({
      protocol: "http",
      host: "10.0.0.1",
      port: 8080,
    });
  });

  test("should parse ipv6 proxy url and strip brackets from host", () => {
    const result = parseProxyUrl("http://[::1]:8080");

    expect(result).toEqual({
      protocol: "http",
      host: "::1",
      port: 8080,
    });
  });

  test("should parse proxy url with auth", () => {
    const result = parseProxyUrl("http://user:pass@10.0.0.1:8080");

    expect(result).toEqual({
      protocol: "http",
      host: "10.0.0.1",
      port: 8080,
      auth: {
        username: "user",
        password: "pass",
      },
    });
  });

  test("should decode percent-encoded auth", () => {
    const result = parseProxyUrl("http://user:p%40ss%3Aword@10.0.0.1:8080");

    expect(result?.auth).toEqual({
      username: "user",
      password: "p@ss:word",
    });
  });

  test("should use default ports by protocol", () => {
    expect(parseProxyUrl("http://proxy.internal")).toEqual({
      protocol: "http",
      host: "proxy.internal",
      port: 80,
    });
    expect(parseProxyUrl("https://proxy.internal")).toEqual({
      protocol: "https",
      host: "proxy.internal",
      port: 443,
    });
  });

  test("should return undefined for invalid or unsupported url", () => {
    expect(parseProxyUrl("")).toBeUndefined();
    expect(parseProxyUrl("not-a-valid-url")).toBeUndefined();
    expect(parseProxyUrl("socks5://10.0.0.1:1080")).toBeUndefined();
  });
});

describe("buildStsHttpOptions", () => {
  test("should return undefined when sts proxy tls params are empty", () => {
    expect(buildStsHttpOptions({})).toBeUndefined();
    expect(
      buildStsHttpOptions({
        proxyUrl: "",
        caFile: "",
        insecureSkipVerify: false,
      }),
    ).toBeUndefined();
  });

  test("should map sts proxy tls params to http options", () => {
    const result = buildStsHttpOptions({
      proxyUrl: "http://10.0.0.1:8080",
      caFile: "/etc/ssl/ca.pem",
      insecureSkipVerify: true,
    });

    expect(result).toEqual({
      proxyUrl: "http://10.0.0.1:8080",
      caFile: "/etc/ssl/ca.pem",
      ignoreSSL: true,
    });
  });
});

describe("assertCaFileReadable", () => {
  test("should allow readable caFile", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-core-ca-check-"));
    const caFilePath = path.join(tempDir, "ca.pem");
    fs.writeFileSync(caFilePath, "mock-ca");

    try {
      expect(() => assertCaFileReadable(caFilePath)).not.toThrow();
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("should throw when caFile is not readable", () => {
    expect(() => assertCaFileReadable("/path/does/not/exist/ca.pem")).toThrow();
  });

  test("should throw when caFile path is a directory", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-core-ca-dir-"));

    try {
      expect(() => assertCaFileReadable(tempDir)).toThrow(
        "caFile is not readable",
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
