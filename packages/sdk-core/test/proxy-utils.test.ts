import {
  describe,
  test,
  expect,
  beforeEach,
  afterAll,
  jest,
} from "@jest/globals";
import { resolveHttpOptions } from "../src/utils/proxy";
import { ClientConfig } from "../src/types/types";

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
