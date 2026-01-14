/**
 * httpsAgent 功能测试用例
 *
 * 此测试文件验证 httpsAgent 配置是否正确工作
 */

import * as https from "https";
import { Client, Command } from "../src/index";
import { AxiosRequestHandler } from "../src/types/types";

// 使用 BadSSL.com 的测试域名进行真实 SSL 测试
const BAD_SSL_HOSTS = {
  selfSigned: "self-signed.badssl.com",
  expired: "expired.badssl.com",
  wrongHost: "wrong.host.badssl.com",
  untrustedRoot: "untrusted-root.badssl.com",
};

describe("httpsAgent SSL Verification", () => {
  describe("默认行为（启用 SSL 验证）", () => {
    it("应该阻止自签名证书", async () => {
      const client = new Client({
        region: "cn-beijing",
        host: BAD_SSL_HOSTS.selfSigned,
        protocol: "https",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        // 不配置 httpsAgent，使用默认 SSL 验证
      });

      const command = new Command({ test: "data" });
      (command as any).requestConfig = {
        params: { Action: "Test", Version: "2021-01-01" },
        serviceName: "test",
        method: "GET",
      };

      await expect(client.send(command)).rejects.toThrow(
        /self-signed|certificate|SSL/i
      );

      client.destroy();
    }, 15000);

    it("应该阻止过期证书", async () => {
      const client = new Client({
        region: "cn-beijing",
        host: BAD_SSL_HOSTS.expired,
        protocol: "https",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
      });

      const command = new Command({ test: "data" });
      (command as any).requestConfig = {
        params: { Action: "Test", Version: "2021-01-01" },
        serviceName: "test",
        method: "GET",
      };

      await expect(client.send(command)).rejects.toThrow(
        /expired|certificate/i
      );

      client.destroy();
    }, 15000);

    it("应该阻止域名不匹配证书", async () => {
      const client = new Client({
        region: "cn-beijing",
        host: BAD_SSL_HOSTS.wrongHost,
        protocol: "https",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
      });

      const command = new Command({ test: "data" });
      (command as any).requestConfig = {
        params: { Action: "Test", Version: "2021-01-01" },
        serviceName: "test",
        method: "GET",
      };

      await expect(client.send(command)).rejects.toThrow(/host|cert/i);

      client.destroy();
    }, 15000);

    it("应该阻止不受信任的根证书", async () => {
      const client = new Client({
        region: "cn-beijing",
        host: BAD_SSL_HOSTS.untrustedRoot,
        protocol: "https",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
      });

      const command = new Command({ test: "data" });
      (command as any).requestConfig = {
        params: { Action: "Test", Version: "2021-01-01" },
        serviceName: "test",
        method: "GET",
      };

      await expect(client.send(command)).rejects.toThrow(
        /self-signed|untrusted|certificate/i
      );

      client.destroy();
    }, 15000);
  });

  describe("禁用 SSL 验证（使用 httpsAgent）", () => {
    it("应该允许自签名证书通过", async () => {
      const client = new Client({
        region: "cn-beijing",
        host: BAD_SSL_HOSTS.selfSigned,
        protocol: "https",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        httpOptions: {
          httpsAgent: new https.Agent({
            rejectUnauthorized: false, // 关键：禁用 SSL 验证
          }),
        },
      });

      const command = new Command({ test: "data" });
      (command as any).requestConfig = {
        params: { Action: "Test", Version: "2021-01-01" },
        serviceName: "test",
        method: "GET",
      };

      // 不应该抛出 SSL 错误
      await expect(client.send(command)).resolves.toBeDefined();

      client.destroy();
    }, 15000);

    it("应该允许过期证书通过", async () => {
      const client = new Client({
        region: "cn-beijing",
        host: BAD_SSL_HOSTS.expired,
        protocol: "https",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        httpOptions: {
          httpsAgent: new https.Agent({
            rejectUnauthorized: false,
          }),
        },
      });

      const command = new Command({ test: "data" });
      (command as any).requestConfig = {
        params: { Action: "Test", Version: "2021-01-01" },
        serviceName: "test",
        method: "GET",
      };

      await expect(client.send(command)).resolves.toBeDefined();

      client.destroy();
    }, 15000);

    it("应该允许域名不匹配证书通过", async () => {
      const client = new Client({
        region: "cn-beijing",
        host: BAD_SSL_HOSTS.wrongHost,
        protocol: "https",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        httpOptions: {
          httpsAgent: new https.Agent({
            rejectUnauthorized: false,
          }),
        },
      });

      const command = new Command({ test: "data" });
      (command as any).requestConfig = {
        params: { Action: "Test", Version: "2021-01-01" },
        serviceName: "test",
        method: "GET",
      };

      await expect(client.send(command)).resolves.toBeDefined();

      client.destroy();
    }, 15000);
  });

  describe("自定义 RequestHandler 配置", () => {
    it("应该在自定义 handler 中应用 httpsAgent", async () => {
      const customHandler = new AxiosRequestHandler({
        timeout: 10000,
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
      });

      const client = new Client({
        region: "cn-beijing",
        host: BAD_SSL_HOSTS.selfSigned,
        protocol: "https",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        requestHandler: customHandler,
      });

      const command = new Command({ test: "data" });
      (command as any).requestConfig = {
        params: { Action: "Test", Version: "2021-01-01" },
        serviceName: "test",
        method: "GET",
      };

      // 不应该抛出 SSL 错误
      await expect(client.send(command)).resolves.toBeDefined();

      client.destroy();
    }, 15000);

    it("应该在 httpOptions 和自定义 handler 中同时配置 httpsAgent", async () => {
      const customHandler = new AxiosRequestHandler({
        timeout: 10000,
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
      });

      const client = new Client({
        region: "cn-beijing",
        host: BAD_SSL_HOSTS.expired,
        protocol: "https",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        requestHandler: customHandler, // 使用自定义 handler
        httpOptions: {
          timeout: 15000, // 额外的 http 配置
        },
      });

      const command = new Command({ test: "data" });
      (command as any).requestConfig = {
        params: { Action: "Test", Version: "2021-01-01" },
        serviceName: "test",
        method: "GET",
      };

      // 不应该抛出 SSL 错误
      await expect(client.send(command)).resolves.toBeDefined();

      client.destroy();
    }, 15000);
  });

  describe("httpsAgent 配置验证", () => {
    it("应该正确传递 httpsAgent 到 HTTP 请求", async () => {
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false,
        timeout: 20000,
      });

      // 创建一个自定义 handler 并传入 httpsAgent
      const customHandler = new AxiosRequestHandler({
        httpsAgent: httpsAgent,
      });

      // 验证在构造函数中传入的 httpsAgent 被正确存储
      // 注意：httpsAgent 被传递给了 axios 实例，而不是每个请求
      expect(customHandler).toBeDefined();

      const client = new Client({
        region: "cn-beijing",
        host: BAD_SSL_HOSTS.selfSigned,
        protocol: "https",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        requestHandler: customHandler,
      });

      const command = new Command({ test: "data" });
      (command as any).requestConfig = {
        params: { Action: "Test", Version: "2021-01-01" },
        serviceName: "test",
        method: "GET",
      };

      // 验证请求能够成功（说明 httpsAgent 配置生效）
      await expect(client.send(command)).resolves.toBeDefined();

      client.destroy();
    }, 15000);

    it("应该支持自定义 CA 证书", () => {
      // 创建测试 CA 证书（仅用于测试，不是真实证书）
      const testCA = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKL8mRxS1clTMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX
aWRnaXRzIFB0eSBMdGQwHhcNMTcwODI4MTQyMzQ3WhcNMTgwODI4MTQyMzQ3WjBF
MQswCQYDVQQGEwJBVTETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50
ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB
CgKCAQEAw7E0K7Da7u0qMzSr5GJ9c9v1KWgz82FHwFv4yKJ3l6MZ5aLjh3x
-----END CERTIFICATE-----`;

      const httpsAgent = new https.Agent({
        ca: testCA,
      });

      const client = new Client({
        region: "cn-beijing",
        host: "test.example.com",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        httpOptions: {
          httpsAgent: httpsAgent,
        },
      });

      expect(client.config.httpOptions?.httpsAgent).toBeDefined();
      expect(client.config.httpOptions?.httpsAgent).toBe(httpsAgent);

      client.destroy();
    });
  });
});
