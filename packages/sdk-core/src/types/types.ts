import type { RequestHandler } from "./request-handler";
import type { Clock } from "./clock";
import { AssumeRoleRequest } from "../client/stsClient/types";
import type { Provider } from "../credentials/types";

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

// Re-export credential types for convenience
export type { CredentialValue, Provider } from "../credentials/types";

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

export interface StsAssumeRoleParams {
  accessKeyId: string;
  secretAccessKey: string;
  roleTrn: string;
  roleSessionName?: string;
  host?: string;
  protocol?: "https" | "http";
  region?: string;
  durationSeconds?: number;
  policy?: string;
  tags?: AssumeRoleRequest["Tags"];
}

export interface AssumeRoleWithOIDCParams {
  roleTrn: string;
  roleSessionName?: string;
  oidcTokenFile: string;
  host?: string;
  protocol?: "https" | "http";
  region?: string;
  durationSeconds?: number;
  policy?: string;
}

export interface AssumeRoleWithSAMLParams {
  roleTrn: string;
  accountId: string;
  samlProviderTrn: string;
  samlAssertion: string;
  host?: string;
  protocol?: "https" | "http";
  region?: string;
  durationSeconds?: number;
  policy?: string;
}

export interface EcsRoleParams {
  roleName: string;
  host?: string;
  protocol?: "https" | "http";
  timeoutMs?: number;
}

export interface HttpOptions {
  /**
   * 连接超时时间（毫秒），TCP 握手阶段的超时限制
   * 通过 http.Agent / https.Agent 的 timeout 实现
   */
  connectTimeout?: number;
  /**
   * 读取超时时间（毫秒），从请求发出到响应数据接收完毕的超时限制
   * 对应 axios 的 timeout 配置
   */
  readTimeout?: number;
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

// ============================================================================
// Debug & Logging types
// ============================================================================

/**
 * Bitmask-based log levels for fine-grained debug output control.
 *
 * Combine levels with bitwise OR (`|`):
 * ```ts
 * logLevel: LogLevel.LOG_DEBUG_WITH_REQUEST | LogLevel.LOG_DEBUG_WITH_RESPONSE
 * ```
 */
export enum LogLevel {
  /** Request line & basic request info: HTTP method, URL (with query params), request headers */
  LOG_DEBUG_WITH_REQUEST = 1 << 0,
  /** Request body (implies LOG_DEBUG_WITH_REQUEST) */
  LOG_DEBUG_WITH_REQUEST_BODY = 1 << 1,
  /** RequestId from response metadata (implies LOG_DEBUG_WITH_REQUEST) */
  LOG_DEBUG_WITH_REQUEST_ID = 1 << 2,
  /** Response status code & response headers (implies LOG_DEBUG_WITH_REQUEST) */
  LOG_DEBUG_WITH_RESPONSE = 1 << 3,
  /** Response body (implies LOG_DEBUG_WITH_RESPONSE) */
  LOG_DEBUG_WITH_RESPONSE_BODY = 1 << 4,
  /** Signing process details (implies LOG_DEBUG_WITH_REQUEST) */
  LOG_DEBUG_WITH_SIGNING = 1 << 5,
  /** Endpoint resolution process (implies LOG_DEBUG_WITH_REQUEST) */
  LOG_DEBUG_WITH_ENDPOINT = 1 << 6,
  /** Retry information (implies LOG_DEBUG_WITH_REQUEST) */
  LOG_DEBUG_WITH_REQUEST_RETRIES = 1 << 7,
  /** Key configuration details (implies LOG_DEBUG_WITH_REQUEST) */
  LOG_DEBUG_WITH_CONFIG = 1 << 8,
  /** All of the above */
  LOG_DEBUG_ALL = (1 << 9) - 1,
}

/**
 * Logger interface for debug output.
 * Users can supply a custom logger (e.g. winston, pino) that satisfies this interface.
 */
export interface DebugLogger {
  debug(message: string): void;
}

/**
 * Debug & logging configuration options.
 */
export interface DebugOptions {
  /**
   * Enable debug mode.
   * @default false
   */
  debug?: boolean;

  /**
   * Bitmask of enabled log levels.
   * @default LogLevel.LOG_DEBUG_ALL (when debug is true)
   */
  logLevel?: number;

  /**
   * Path to a file for log output.
   * When not set, logs are written to stderr (console).
   * @default undefined
   */
  loggerFile?: string;

  /**
   * Log line format. Supported placeholders:
   * - `%(timestamp)s` - ISO 8601 timestamp
   * - `%(level)s`     - log level string
   * - `%(message)s`   - the log message body
   * @default "%(timestamp)s %(level)s %(message)s"
   */
  loggerFormat?: string;

  /**
   * Custom logger instance. When provided, `loggerFile` and `loggerFormat`
   * are ignored.
   */
  logger?: DebugLogger;
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
  _jumpCredential?: boolean;

  /**
   * Credential provider instance.
   *
   * When set, the credentials middleware will call
   * `credentialProvider.resolveCredentials()` to obtain AK/SK(/Token).
   *
   * Built-in providers:
   *   - StaticCredentialProvider
   *   - EnvironmentVariableCredentialProvider
   *   - StsAssumeRoleProvider
   *   - SamlCredentialProvider
   *   - OidcCredentialProvider
   *   - CLIConfigCredentialProvider
   *   - DefaultCredentialProvider (credential chain)
   *
   * If neither `accessKeyId`/`secretAccessKey` nor `credentialProvider` is
   * set, `DefaultCredentialProvider` is used automatically.
   */
  credentialProvider?: Provider;

  /** @deprecated Use `new StsAssumeRoleProvider(params)` as credentialProvider instead */
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

  /**
   * Debug & logging configuration.
   * When provided, enables SDK debug output with fine-grained log level control.
   *
   * @example
   * ```ts
   * debugOptions: {
   *   debug: true,
   *   logLevel: LogLevel.LOG_DEBUG_WITH_REQUEST | LogLevel.LOG_DEBUG_WITH_RESPONSE,
   *   loggerFile: "sdk-debug.log",
   * }
   * ```
   */
  debugOptions?: DebugOptions;
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
