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
import https from "https";
import { HttpOptions } from "../types/types";

export type AxiosRequestHandlerOptions = HttpOptions;

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
    clientFactory: (config: AxiosRequestConfig) => AxiosInstance = axios.create
  ) {
    let httpsAgent = options.httpsAgent;
    if (!httpsAgent) {
      if (options.ignoreSSL || options.pool) {
        const agentOptions: https.AgentOptions = {};

        if (options.ignoreSSL) {
          agentOptions.rejectUnauthorized = false;
        }

        if (options.pool) {
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

        httpsAgent = new https.Agent(agentOptions);
      }
    }
    this.client = clientFactory({
      timeout: options.timeout,
      proxy: options.proxy,
      httpsAgent: httpsAgent,
    });
  }

  /**
   * 发送 HTTP 请求
   */
  async request<T>(config: HttpRequestConfig): Promise<HttpResponse<T>> {
    const axiosConfig: AxiosRequestConfig = {
      url: config.url,
      method: config.method as any,
      headers: config.headers,
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
