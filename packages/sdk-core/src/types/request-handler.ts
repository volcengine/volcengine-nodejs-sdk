/**
 * HTTP 请求处理器接口
 * 抽象不同 HTTP 实现（axios、fetch、node-fetch 等）
 * 参考 AWS SDK v3 的 requestHandler 设计
 */

/**
 * HTTP 响应接口
 */
export interface HttpResponse<T = any> {
  status: number;
  statusText: string;
  headers: Record<string, string | string[]>;
  data: T;
}

/**
 * HTTP 请求配置
 */
export interface HttpRequestConfig {
  url: string;
  method?: string;
  headers?: Record<string, any>;
  data?: any;
  timeout?: number;
  validateStatus?: (status: number) => boolean;
  proxy?: {
    protocol: string;
    host: string;
    port: number;
  };
  /**
   * AbortController 的 signal，用于取消请求
   */
  signal?: AbortSignal;
  /**
   * HTTPS 代理配置（例如用于忽略 SSL 验证）
   * 在 axios 中对应 httpsAgent 配置
   */
  httpsAgent?: any;
}

/**
 * 请求处理器接口
 * 实现此接口可自定义 HTTP 客户端（如 axios、fetch、node-fetch 等）
 */
export interface RequestHandler {
  /**
   * 发送 HTTP 请求
   * @param config 请求配置
   * @returns Promise<HttpResponse>
   */
  request<T = any>(config: HttpRequestConfig): Promise<HttpResponse<T>>;

  /**
   * 销毁/清理资源（可选）
   */
  destroy?(): void;
}
