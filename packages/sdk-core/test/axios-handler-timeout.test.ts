/**
 * AxiosRequestHandler 连接超时 & 读取超时 验证测试
 *
 * 修复后的行为：
 * 1. connectTimeout 通过 Agent.createConnection 重写实现真正的 TCP 连接超时
 *    （而非旧实现的 Agent.timeout socket idle timeout）
 * 2. 同时创建 httpAgent 和 httpsAgent，确保 HTTP/HTTPS 都生效
 * 3. readTimeout 传递给 axios 的 timeout，控制整体请求超时
 * 4. http-request.ts 中的优先级：
 *    request.timeout ?? httpOptions.readTimeout ?? httpOptions.timeout ?? 30000
 */

import { AxiosRequestHandler } from "../src/request-handlers/axios-handler";
import { HttpOptions } from "../src/types/types";
import type { AxiosInstance, AxiosRequestConfig } from "axios";
import http from "http";
import https from "https";

describe("AxiosRequestHandler - connectTimeout & readTimeout（修复后）", () => {
  let mockClientFactory: jest.Mock;
  let mockAxiosInstance: Partial<AxiosInstance>;
  let capturedAxiosConfig: AxiosRequestConfig;

  beforeEach(() => {
    mockAxiosInstance = {
      request: jest.fn().mockResolvedValue({
        status: 200,
        statusText: "OK",
        headers: {},
        data: { success: true },
      }),

    };
    mockClientFactory = jest.fn((config: AxiosRequestConfig) => {
      capturedAxiosConfig = config;
      // 将 defaults 设置为传入的配置以便后续测试
      (mockAxiosInstance as any).defaults = {
        ...config,
        adapter: undefined,
      };
      return mockAxiosInstance as AxiosInstance;
    });
  });

  // =========================================================================
  // connectTimeout 实现正确性
  // =========================================================================
  describe("connectTimeout: 通过 createConnection 重写实现 TCP 连接超时", () => {
    test("设置 connectTimeout 时应创建带 createConnection 重写的 httpsAgent", () => {
      new AxiosRequestHandler({ connectTimeout: 3000 }, mockClientFactory);

      const config = capturedAxiosConfig;
      expect(config.httpsAgent).toBeInstanceOf(https.Agent);
      // 新实现不再设置 Agent.options.timeout
      // 而是通过 createConnection 重写实现连接超时
      expect(config.httpsAgent.options.timeout).toBeUndefined();
    });

    test("设置 connectTimeout 时应同时创建 httpAgent（修复 HTTP 协议不生效问题）", () => {
      new AxiosRequestHandler({ connectTimeout: 3000 }, mockClientFactory);

      const config = capturedAxiosConfig;
      expect((config as any).httpAgent).toBeInstanceOf(http.Agent);
    });

    test("connectTimeout 不影响 axios 的 timeout（readTimeout 独立控制）", () => {
      new AxiosRequestHandler({ connectTimeout: 3000 }, mockClientFactory);

      const config = capturedAxiosConfig;
      // readTimeout 未设置 → axios.timeout 为 undefined
      expect(config.timeout).toBeUndefined();
    });

    test("Agent 的 createConnection 方法应被重写", () => {
      new AxiosRequestHandler({ connectTimeout: 3000 }, mockClientFactory);

      const config = capturedAxiosConfig;
      const agent = config.httpsAgent;
      // createConnection 应该已被重写（不等于原型上的方法）
      expect(agent.createConnection).toBeDefined();
      expect(agent.createConnection).not.toBe(
        https.Agent.prototype.createConnection
      );
    });

    test("httpAgent 的 createConnection 也应被重写", () => {
      new AxiosRequestHandler({ connectTimeout: 3000 }, mockClientFactory);

      const config = capturedAxiosConfig;
      const agent = (config as any).httpAgent;
      expect(agent.createConnection).toBeDefined();
      expect(agent.createConnection).not.toBe(
        http.Agent.prototype.createConnection
      );
    });
  });

  // =========================================================================
  // readTimeout 回退逻辑
  // =========================================================================
  describe("readTimeout 回退到 timeout 的逻辑", () => {
    test("readTimeout 优先于 timeout", () => {
      new AxiosRequestHandler(
        { readTimeout: 5000, timeout: 10000 },
        mockClientFactory
      );

      const config = capturedAxiosConfig;
      expect(config.timeout).toBe(5000);
    });

    test("当 readTimeout 未设置时，使用 timeout 作为回退", () => {
      new AxiosRequestHandler({ timeout: 10000 }, mockClientFactory);

      const config = capturedAxiosConfig;
      expect(config.timeout).toBe(10000);
    });

    test("当 readTimeout=0 时，应使用 0 而非回退到 timeout（?? 对 0 正确）", () => {
      new AxiosRequestHandler(
        { readTimeout: 0, timeout: 10000 },
        mockClientFactory
      );

      const config = capturedAxiosConfig;
      expect(config.timeout).toBe(0);
    });

    test("当 readTimeout 和 timeout 都未设置时，axios timeout 为 undefined", () => {
      new AxiosRequestHandler({}, mockClientFactory);

      const config = capturedAxiosConfig;
      expect(config.timeout).toBeUndefined();
    });
  });

  // =========================================================================
  // connectTimeout 与 readTimeout 的独立性
  // =========================================================================
  describe("connectTimeout 与 readTimeout 互不干扰", () => {
    test("connectTimeout < readTimeout 时不会干扰数据传输（修复前的核心 bug）", () => {
      new AxiosRequestHandler(
        { connectTimeout: 1000, readTimeout: 30000 },
        mockClientFactory
      );

      const config = capturedAxiosConfig;
      // Agent 不再有 timeout 属性，不会在数据传输中途断连
      expect(config.httpsAgent.options.timeout).toBeUndefined();
      // axios timeout = 30000（整体请求超时）
      expect(config.timeout).toBe(30000);
    });

    test("仅设置 connectTimeout 时，读取无超时限制", () => {
      new AxiosRequestHandler({ connectTimeout: 1000 }, mockClientFactory);

      const config = capturedAxiosConfig;
      expect(config.timeout).toBeUndefined(); // 无读取超时
      expect(config.httpsAgent).toBeInstanceOf(https.Agent);
    });

    test("仅设置 readTimeout 时，无连接超时（不创建自定义 Agent）", () => {
      new AxiosRequestHandler({ readTimeout: 5000 }, mockClientFactory);

      const config = capturedAxiosConfig;
      expect(config.timeout).toBe(5000);
      expect(config.httpsAgent).toBeUndefined();
      expect((config as any).httpAgent).toBeUndefined();
    });

    test("同时设置所有超时参数的完整配置", () => {
      new AxiosRequestHandler(
        {
          connectTimeout: 3000,
          readTimeout: 15000,
          timeout: 30000, // 被 readTimeout 覆盖
        },
        mockClientFactory
      );

      const config = capturedAxiosConfig;
      expect(config.httpsAgent).toBeInstanceOf(https.Agent);
      expect((config as any).httpAgent).toBeInstanceOf(http.Agent);
      expect(config.timeout).toBe(15000); // readTimeout 优先
      expect(config.httpsAgent.options.timeout).toBeUndefined(); // 不再 pollute Agent.timeout
    });
  });

  // =========================================================================
  // connectTimeout 与其他 Agent 选项组合
  // =========================================================================
  describe("connectTimeout 与其他选项的组合", () => {
    test("connectTimeout + ignoreSSL 应同时生效", () => {
      new AxiosRequestHandler(
        { connectTimeout: 3000, ignoreSSL: true },
        mockClientFactory
      );

      const config = capturedAxiosConfig;
      expect(config.httpsAgent).toBeInstanceOf(https.Agent);
      expect(config.httpsAgent.options.rejectUnauthorized).toBe(false);
      // createConnection 被重写
      expect(config.httpsAgent.createConnection).not.toBe(
        https.Agent.prototype.createConnection
      );
    });

    test("connectTimeout + pool 选项应同时生效", () => {
      new AxiosRequestHandler(
        {
          connectTimeout: 3000,
          pool: { keepAlive: true, maxSockets: 10 },
        },
        mockClientFactory
      );

      const config = capturedAxiosConfig;
      expect(config.httpsAgent).toBeInstanceOf(https.Agent);
      expect(config.httpsAgent.options.keepAlive).toBe(true);
      expect(config.httpsAgent.options.maxSockets).toBe(10);
    });

    test("当提供自定义 httpsAgent 时，connectTimeout 被忽略（自定义优先）", () => {
      const customAgent = new https.Agent({ keepAlive: true });
      new AxiosRequestHandler(
        { connectTimeout: 3000, httpsAgent: customAgent },
        mockClientFactory
      );

      const config = capturedAxiosConfig;
      expect(config.httpsAgent).toBe(customAgent);
      // 自定义 Agent 的 createConnection 未被修改
      expect(config.httpsAgent.createConnection).toBe(
        https.Agent.prototype.createConnection
      );
    });

    test("不设置 connectTimeout 但设置 pool 时，应创建普通 Agent（无 createConnection 重写）", () => {
      new AxiosRequestHandler(
        { pool: { keepAlive: true } },
        mockClientFactory
      );

      const config = capturedAxiosConfig;
      expect(config.httpsAgent).toBeInstanceOf(https.Agent);
      // 普通 Agent，createConnection 未被重写
      expect(config.httpsAgent.createConnection).toBe(
        https.Agent.prototype.createConnection
      );
    });

    test("不设置 connectTimeout 但设置 ignoreSSL 时，创建普通 Agent", () => {
      new AxiosRequestHandler({ ignoreSSL: true }, mockClientFactory);

      const config = capturedAxiosConfig;
      expect(config.httpsAgent).toBeInstanceOf(https.Agent);
      expect(config.httpsAgent.options.rejectUnauthorized).toBe(false);
      expect(config.httpsAgent.createConnection).toBe(
        https.Agent.prototype.createConnection
      );
    });
  });

  // =========================================================================
  // 请求级别 timeout 覆盖
  // =========================================================================
  describe("请求级别 timeout 覆盖构造器级别配置", () => {
    test("request() 中的 timeout 应覆盖构造器中的 readTimeout", async () => {
      const handler = new AxiosRequestHandler(
        { readTimeout: 10000 },
        mockClientFactory
      );

      await handler.request({
        url: "https://example.com/api",
        method: "GET",
        headers: {},
        data: undefined,
        timeout: 2000,
      });

      const requestCall = (mockAxiosInstance.request as jest.Mock).mock
        .calls[0][0];
      expect(requestCall.timeout).toBe(2000);
    });

    test("request() 中未设置 timeout 时，不传递 timeout（使用 instance 默认）", async () => {
      const handler = new AxiosRequestHandler(
        { readTimeout: 10000 },
        mockClientFactory
      );

      await handler.request({
        url: "https://example.com/api",
        method: "GET",
        headers: {},
        data: undefined,
      });

      const requestCall = (mockAxiosInstance.request as jest.Mock).mock
        .calls[0][0];
      expect(requestCall.timeout).toBeUndefined();
    });
  });

  // =========================================================================
  // 边界值和异常输入
  // =========================================================================
  describe("边界值和异常输入", () => {
    test("connectTimeout=0 应创建带 createConnection 重写的 Agent", () => {
      new AxiosRequestHandler({ connectTimeout: 0 }, mockClientFactory);

      const config = capturedAxiosConfig;
      expect(config.httpsAgent).toBeInstanceOf(https.Agent);
      expect(config.httpsAgent.createConnection).not.toBe(
        https.Agent.prototype.createConnection
      );
    });

    test("不配置任何选项时，不创建 Agent", () => {
      new AxiosRequestHandler({}, mockClientFactory);

      const config = capturedAxiosConfig;
      expect(config.httpsAgent).toBeUndefined();
      expect((config as any).httpAgent).toBeUndefined();
      expect(config.timeout).toBeUndefined();
    });

    test("pool 配置时应同时创建 httpAgent", () => {
      new AxiosRequestHandler(
        { pool: { keepAlive: true } },
        mockClientFactory
      );

      const config = capturedAxiosConfig;
      expect(config.httpsAgent).toBeInstanceOf(https.Agent);
      expect((config as any).httpAgent).toBeInstanceOf(http.Agent);
    });
  });
});
