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
import http from "http";
import https from "https";
import type { Socket } from "net";
import { HttpOptions } from "../types/types";
import { SDK_NAME, SDK_VERSION } from "../version";

export type AxiosRequestHandlerOptions = HttpOptions;

/**
 * 默认 User-Agent，格式为 <SDK 名称>/<版本>
 */
const DEFAULT_USER_AGENT = `${SDK_NAME}/${SDK_VERSION}`;

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
      proxy: options.proxy,
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
    const customUserAgent =
      userAgentKey !== undefined ? String(headers[userAgentKey]).trim() : "";
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

    const axiosConfig: AxiosRequestConfig = {
      url: config.url,
      method: config.method as any,
      headers,
      data: config.data,
      timeout: config.timeout,
      proxy: config.proxy,
      httpsAgent: config.httpsAgent,
      signal: config.signal,
    };
    const response: AxiosResponse<T> = await this.client.request(axiosConfig);

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
