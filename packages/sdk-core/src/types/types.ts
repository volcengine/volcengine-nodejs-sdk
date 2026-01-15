import type { RequestHandler } from "./request-handler";
import type { Clock } from "./clock";
import { AssumeRoleRequest } from "../client/stsClient/types";

// ============================================================================
// Core SDK types shared across client and commands
// ============================================================================

// ============================================================================
// Re-export core abstractions
// ============================================================================
export type {
  RequestHandler,
  HttpRequestConfig,
  HttpResponse,
} from "./request-handler";

export type { Clock } from "./clock";

export { AxiosRequestHandler } from "../request-handlers/axios-handler";
export { RealClock } from "./clock";
export { HttpRequestError } from "./http-request-error";

export {
  MiddlewareStack,
  createSimpleMiddleware,
  createMiddleware,
} from "../middlewares";

/**
 * Retry mode,
 * - NoBackoffStrategy: No retry strategy (default)
 * - ExponentialBackoffStrategy: Exponential backoff strategy
 * - ExponentialWithRandomJitterBackoffStrategy: Exponential backoff strategy with random jitter
 */
export enum StrategyName {
  NoBackoffStrategy = "NoBackoffStrategy",
  ExponentialBackoffStrategy = "ExponentialBackoffStrategy",
  ExponentialWithRandomJitterBackoffStrategy = "ExponentialWithRandomJitterBackoffStrategy",
}

export interface RetryStrategy {
  minRetryDelay?: number;
  maxRetryDelay?: number;
  strategyName?: StrategyName;
  delay?: (attemptNumber: number) => number;
  retryIf?: (error: any) => boolean;
}
export interface AssumeRoleParams {
  accessKeyId: string;
  secretAccessKey: string;
  roleName: string;
  accountId: string;
  host?: string;
  protocol?: "https" | "http";
  region?: string;
  durationSeconds?: number;
  policy?: string;
  tags?: AssumeRoleRequest["Tags"];
}

export interface HttpOptions {
  timeout?: number;
  proxy?: {
    protocol?: "http" | "https";
    host: string;
    port: number;
  };
  /**
   * HTTPS 代理配置（例如用于忽略 SSL 验证）
   * 在 axios 中对应 httpsAgent 配置
   * 示例: new https.Agent({ rejectUnauthorized: false })
   */
  httpsAgent?: any;
  /**
   * 是否忽略 SSL 验证错误
   */
  ignoreSSL?: boolean;
  pool?: {
    keepAlive?: boolean; // 开启
    keepAliveMsecs?: number; // 时间
    maxSockets?: number; //最大连接数
    maxFreeSockets?: number; /// 最大空闲连接数
  };
}
export interface ClientConfig {
  host?: string;
  region?: string;
  protocol?: "https" | "http";
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  autoRetry?: boolean;
  maxRetries?: number;
  retryStrategy?: RetryStrategy;
  assumeRoleParams?: AssumeRoleParams;
  useDualStack?: boolean;

  /**
   * 自定义引导区域，用于初始化 SDK 时指定区域
   * 若未提供，将使用默认引导区域列表
   */
  customBootstrapRegion?: Record<string, any>;

  /**
   * HTTP 配置（优先级低于 requestHandler）
   * 如果提供了 requestHandler，则此配置无效
   */
  httpOptions?: HttpOptions;

  /**
   * 自定义请求处理器（高级用法）
   * 如果未提供，使用默认的 AxiosRequestHandler
   */
  requestHandler?: RequestHandler;

  /**
   * 时钟实现
   * 如果未提供，使用默认的 RealClock
   */
  clock?: Clock;
}

/**
 * send() 方法的 options 参数
 */
export interface SendOptions {
  /**
   * AbortController 的 signal，用于取消请求
   */
  abortSignal?: AbortSignal;
  /**
   * Request-level timeout in milliseconds
   * Overrides client-level httpOptions.timeout
   */
  timeout?: number;
}

// ============================================================================
// Output Types
// ============================================================================

export interface ResponseMetadata {
  RequestId: string;
  Action: string;
  Version: string;
  Service: string;
  Region: string;
  Error?: {
    CodeN: number;
    Code: string;
    Message: string;
  };
}

export interface CommandInput {
  [key: string]: any;
}

export interface CommandOutputMap {
  [key: string]: any;
}

export interface CommandOutput<T = any> {
  ResponseMetadata: ResponseMetadata;
  Result?: T;
}

// ============================================================================
// MetaPath types
// ============================================================================

export interface MetaPathInfo {
  action: string;
  version: string;
  serviceName: string;
  method: string;
  contentType: string;
}
