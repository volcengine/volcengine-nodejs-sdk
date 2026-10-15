/**
 * Axios HTTP 请求处理器实现
 * 作为默认的 RequestHandler 实现
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import {
  RequestHandler,
  HttpRequestConfig,
  HttpResponse,
} from "../types/request-handler";
import fs from "fs";
import http from "http";
import https from "https";
import type { Socket } from "net";
import tls from "tls";
import { HttpOptions } from "../types/types";
import { parseProxyUrl } from "../utils/proxy";
import { SDK_NAME, SDK_VERSION } from "../version";

export type AxiosRequestHandlerOptions = HttpOptions;

/**
 * 默认 User-Agent，格式为 <SDK 名称>/<版本>
 */
const DEFAULT_USER_AGENT = `${SDK_NAME}/${SDK_VERSION}`;

// 保持兜底超时错误与 axios timeout 错误形态一致，
// 确保现有 middleware 和重试逻辑仍能将其识别为网络超时。
function createTimeoutError(timeout: number): Error {
  const error = new Error(`timeout of ${timeout}ms exceeded`);
  (error as any).code = "ECONNABORTED";
  (error as any).timeout = timeout;
  return error;
}

// 将调用方传入的 signal 接入内部超时 controller，
// 既保留用户主动取消能力，也允许 handler 执行自己的总耗时兜底。
function addAbortListener(
  signal: AbortSignal | undefined,
  listener: () => void,
): () => void {
  if (!signal) {
    return () => {};
  }

  signal.addEventListener("abort", listener, { once: true });
  return () => signal.removeEventListener("abort", listener);
}

/**
 * 创建带有连接超时的 Agent
 *
 * Node.js 的 Agent.timeout 是 socket idle timeout，不是 TCP 连接超时。
 * 真正的连接超时需要在 socket 的 'connect' 事件触发前设置定时器，
 * 若超时则销毁 socket。
 *
 * 实现方式：通过重写 Agent 的 createConnection 方法，在 socket 创建后
 * 添加连接超时逻辑。
 */
function createAgentWithConnectTimeout<T extends http.Agent>(
  AgentClass: new (options: any) => T,
  agentOptions: any,
  connectTimeout: number,
): T {
  const agent = new AgentClass(agentOptions);

  const originalCreateConnection = (agent as any).createConnection;

  (agent as any).createConnection = function (
    options: any,
    callback: (err: Error | null, socket?: Socket) => void,
  ) {
    const socket: Socket = originalCreateConnection.call(
      this,
      options,
      callback,
    );

    let connectTimer: ReturnType<typeof setTimeout> | null = null;

    const onConnect = () => {
      if (connectTimer) {
        clearTimeout(connectTimer);
        connectTimer = null;
      }
    };

    const onError = () => {
      if (connectTimer) {
        clearTimeout(connectTimer);
        connectTimer = null;
      }
    };

    // 设置连接超时计时器
    connectTimer = setTimeout(() => {
      socket.removeListener("connect", onConnect);
      socket.removeListener("error", onError);
      socket.destroy(
        new Error(`Connect timeout of ${connectTimeout}ms exceeded`),
      );
    }, connectTimeout);

    socket.once("connect", onConnect);
    socket.once("error", onError);

    return socket;
  };

  return agent;
}

/**
 * Axios 实现的 RequestHandler
 * 功能完整、稳定可靠，作为默认实现
 */
export class AxiosRequestHandler implements RequestHandler {
  private client: AxiosInstance;
  private readonly resolvedProxy?: AxiosRequestConfig["proxy"];
  private readonly requestTimeout?: number;

  /**
   * 构造函数
   * @param options Axios 配置选项
   * @param clientFactory Axios 实例工厂函数（用于测试时注入 mock）
   */
  constructor(
    options: HttpOptions = {},
    clientFactory: (config: AxiosRequestConfig) => AxiosInstance = axios.create,
  ) {
    // 超时配置：connectTimeout 控制 TCP 连接阶段，readTimeout 控制整体请求响应阶段
    const connectTimeout = options.connectTimeout;
    const readTimeout = options.readTimeout ?? options.timeout;
    this.requestTimeout = readTimeout;

    if (options.proxyUrl !== undefined && options.proxyUrl !== "") {
      const parsedProxy = parseProxyUrl(options.proxyUrl);
      if (!parsedProxy) {
        throw new Error("Invalid proxyUrl");
      }

      this.resolvedProxy = {
        protocol: parsedProxy.protocol,
        host: parsedProxy.host,
        port: parsedProxy.port,
        ...(parsedProxy.auth ? { auth: parsedProxy.auth } : {}),
      };
    }

    let httpsAgent = options.httpsAgent;
    let httpAgent: http.Agent | undefined;

    // 构建 Agent
    if (!httpsAgent) {
      const agentOptions: https.AgentOptions = {};
      let needsAgent = false;

      if (options.ignoreSSL) {
        agentOptions.rejectUnauthorized = false;
        needsAgent = true;
      }

      if (options.caFile) {
        // Keep Node's default public roots and append the custom CA so
        // HTTPS proxy trust does not break subsequent origin TLS validation.
        agentOptions.ca = [
          ...tls.rootCertificates,
          fs.readFileSync(options.caFile, "utf8"),
        ];
        needsAgent = true;
      }

      if (options.pool) {
        needsAgent = true;
        if (options.pool.keepAlive !== undefined) {
          agentOptions.keepAlive = options.pool.keepAlive;
        }
        if (options.pool.keepAliveMsecs !== undefined) {
          agentOptions.keepAliveMsecs = options.pool.keepAliveMsecs;
        }
        if (options.pool.maxSockets !== undefined) {
          agentOptions.maxSockets = options.pool.maxSockets;
        }
        if (options.pool.maxFreeSockets !== undefined) {
          agentOptions.maxFreeSockets = options.pool.maxFreeSockets;
        }
      }

      if (connectTimeout !== undefined) {
        needsAgent = true;
      }

      if (needsAgent) {
        if (connectTimeout !== undefined) {
          // 使用带连接超时的 Agent
          httpsAgent = createAgentWithConnectTimeout(
            https.Agent,
            agentOptions,
            connectTimeout,
          );
          httpAgent = createAgentWithConnectTimeout(
            http.Agent,
            agentOptions,
            connectTimeout,
          );
        } else {
          httpsAgent = new https.Agent(agentOptions);
          httpAgent = new http.Agent(agentOptions);
        }
      }
    }

    this.client = clientFactory({
      timeout: readTimeout,
      proxy:
        this.resolvedProxy !== undefined ? this.resolvedProxy : options.proxy,
      httpsAgent: httpsAgent,
      httpAgent: httpAgent,
    });
  }

  /**
   * 发送 HTTP 请求
   */
  async request<T>(config: HttpRequestConfig): Promise<HttpResponse<T>> {
    const headers = { ...config.headers };
    // User-Agent 采用 append 模式：SDK 默认 UA 始终保留在前，
    // 用户自定义的 UA 追加在其后（空格分隔），与 Go / PHP SDK 行为一致。
    const userAgentKey = Object.keys(headers).find(
      (key) => key.toLowerCase() === "user-agent",
    );
    const rawUserAgent =
      userAgentKey !== undefined ? headers[userAgentKey] : undefined;
    // undefined / null 视为“无自定义”，回退到默认 UA，与 PHP SDK 行为一致，
    // 避免拼出 "volcengine-nodejs-sdk/x.y.z undefined" 这类脏 UA。
    const customUserAgent =
      rawUserAgent === undefined || rawUserAgent === null
        ? ""
        : String(rawUserAgent).trim();
    if (userAgentKey !== undefined) {
      delete headers[userAgentKey];
    }
    if (
      customUserAgent === "" ||
      customUserAgent === DEFAULT_USER_AGENT ||
      customUserAgent.startsWith(`${DEFAULT_USER_AGENT} `)
    ) {
      // 无自定义，或已包含 SDK UA 前缀，避免重复拼接
      headers["User-Agent"] =
        customUserAgent === "" ? DEFAULT_USER_AGENT : customUserAgent;
    } else {
      headers["User-Agent"] = `${DEFAULT_USER_AGENT} ${customUserAgent}`;
    }

    // axios 为 HTTPS 代理请求安装 CONNECT 隧道 Agent 后，原生 timeout
    // 可能无法覆盖所有 socket 建立前阶段。这里仍然把 timeout 传给
    // axios，同时增加一层总耗时兜底，确保底层 adapter 卡在代理连接时
    // SDK 的超时契约仍然生效。
    const effectiveTimeout = config.timeout ?? this.requestTimeout;
    const hasTotalTimeout =
      effectiveTimeout !== undefined && effectiveTimeout > 0;
    const abortController = hasTotalTimeout
      ? new AbortController()
      : undefined;
    const removeAbortListener = abortController
      ? addAbortListener(config.signal, () => {
          abortController.abort((config.signal as any)?.reason);
        })
      : () => {};

    if (abortController && config.signal?.aborted) {
      abortController.abort((config.signal as any).reason);
    }

    const axiosConfig: AxiosRequestConfig = {
      url: config.url,
      method: config.method as any,
      headers,
      data: config.data,
      timeout: config.timeout,
      proxy: config.proxy,
      httpsAgent: config.httpsAgent,
      signal: abortController?.signal ?? config.signal,
    };

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const requestPromise = this.client.request(axiosConfig);
    const response: AxiosResponse<T> = await (hasTotalTimeout
      ? Promise.race([
          requestPromise,
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              const timeoutError = createTimeoutError(effectiveTimeout);
              reject(timeoutError);
              abortController?.abort(timeoutError);
            }, effectiveTimeout);
          }),
        ])
      : requestPromise).finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      removeAbortListener();
    });

    // 转换为标准 HttpResponse 格式
    return {
      status: response.status,
      statusText: response.statusText,
      headers: this.normalizeHeaders(response.headers),
      data: response.data,
    };
  }

  /**
   * 标准化 headers，将 axios 的 headers 转换为 Record<string, string | string[]>
   * 安全处理 AxiosHeaders 和其他可能的类型
   */
  private normalizeHeaders(headers: any): Record<string, string | string[]> {
    if (!headers) {
      return {};
    }

    const processHeaderValue = (value: any): string | string[] => {
      return Array.isArray(value) ? value : String(value);
    };

    // 如果已经是简单对象，直接返回（类型守卫）
    if (typeof headers === "object" && !headers.get && !headers.set) {
      const result: Record<string, string | string[]> = {};
      Object.keys(headers).forEach((key) => {
        const value = headers[key];
        result[key] = processHeaderValue(value);
      });
      return result;
    }

    // 处理 AxiosHeaders 类实例
    if (typeof headers === "object" && typeof headers.get === "function") {
      const result: Record<string, string | string[]> = {};
      // 尝试获取所有 headers
      try {
        for (const key of Object.keys(headers)) {
          const value = headers.get(key) || headers[key];
          if (value !== undefined && value !== null) {
            result[key] = processHeaderValue(value);
          }
        }
      } catch (e) {
        // 如果获取失败，回退到直接遍历
        Object.keys(headers).forEach((key) => {
          const value = headers[key];
          if (value !== undefined && value !== null) {
            result[key] = processHeaderValue(value);
          }
        });
      }
      return result;
    }

    // 未知类型，尝试最佳努力转换
    return {};
  }

  /**
   * 销毁 axios 实例
   */
  destroy(): void {
    // axios 实例无需特殊清理
    // 这里预留接口，便于子类扩展
  }
}
